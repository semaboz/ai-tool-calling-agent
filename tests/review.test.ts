import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgent } from '../src/agent.ts';
import { DemoModelClient } from '../src/clients.ts';
import type { ModelClient, ModelRequest, ModelResponse } from '../src/types.ts';

test('offline demo uses tool results for the follow-up calculation', async () => {
  const client = new DemoModelClient();
  const first = await client.createResponse({ model: 'demo', instructions: '', input: 'ignored scripted prompt', tools: [] });
  assert.equal(first.output.length, 2);
  const second = await client.createResponse({
    model: 'demo', instructions: '', tools: [], previous_response_id: first.id,
    input: [
      { type: 'function_call_output', call_id: 'call_1', output: JSON.stringify({ ok: true, data: { requests: 200, failures: 10, status: 'degraded' } }) },
      { type: 'function_call_output', call_id: 'call_2', output: JSON.stringify({ ok: true, data: { results: [{ id: 'INC-X' }], count: 1 } }) },
    ],
  });
  const call = second.output[0];
  assert.equal(call?.type, 'function_call');
  assert.deepEqual(JSON.parse(String(call?.arguments)), { total_requests: 200, failed_requests: 10 });

  const third = await client.createResponse({
    model: 'demo', instructions: '', tools: [], previous_response_id: second.id,
    input: [{ type: 'function_call_output', call_id: 'call_3', output: JSON.stringify({ ok: true, data: { error_rate_percent: 5 } }) }],
  });
  const message = third.output[0];
  const content = message?.content as Array<{ text: string }>;
  assert.match(content[0]?.text ?? '', /10 failures out of 200 requests \(5% error rate\)/);
  assert.match(content[0]?.text ?? '', /INC-X/);
});

test('duplicate call IDs are rejected before tools execute', async () => {
  const fake: ModelClient = {
    async createResponse(): Promise<ModelResponse> {
      return { id: 'dup', status: 'completed', output: [
        { type: 'function_call', call_id: 'repeat', name: 'get_service_status', arguments: '{"service_id":"payments-api"}' },
        { type: 'function_call', call_id: 'repeat', name: 'get_service_status', arguments: '{"service_id":"auth-service"}' },
      ] };
    },
  };
  await assert.rejects(runAgent(fake, 'Check services.'), /Duplicate tool call IDs/);
});

test('previous_response_id and outputs are passed to subsequent rounds in order', async () => {
  let round = 0;
  const mock: ModelClient = {
    async createResponse(req: ModelRequest): Promise<ModelResponse> {
      round++;
      if (round === 1) return {
        id: 'initial', status: 'completed', output: [
          { type: 'function_call', call_id: 'first', name: 'get_service_status', arguments: '{"service_id":"payments-api"}' },
          { type: 'function_call', call_id: 'second', name: 'search_incidents', arguments: '{"query":"payments","limit":3}' },
        ],
      };
      assert.equal(req.previous_response_id, 'initial');
      assert.ok(Array.isArray(req.input));
      assert.deepEqual(req.input.map((item) => item.call_id), ['first', 'second']);
      return { id: 'final', status: 'completed', output: [
        { type: 'message', content: [{ type: 'output_text', text: 'Done.' }] },
      ] };
    },
  };
  const result = await runAgent(mock, 'Check payments.');
  assert.deepEqual(result.trace.map((item) => item.callId), ['first', 'second']);
});

test('invalid model response state is rejected', async () => {
  const fake: ModelClient = {
    async createResponse(): Promise<ModelResponse> {
      return { id: 'partial', status: 'incomplete', output: [] };
    },
  };
  await assert.rejects(runAgent(fake, 'Check'), /did not complete/);
});
