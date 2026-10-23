import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgent } from '../src/agent.ts';
import { DemoModelClient } from '../src/clients.ts';
import type { ModelClient, ModelRequest, ModelResponse } from '../src/types.ts';

test('demo agent handles parallel calls and follow-up call', async () => {
  const result = await runAgent(new DemoModelClient(), 'Check payments-api.');
  assert.equal(result.rounds, 3);
  assert.deepEqual(result.trace.map((trace) => trace.tool), [
    'get_service_status', 'search_incidents', 'calculate_error_rate',
  ]);
  assert.ok(result.trace.every((trace) => trace.ok));
  assert.match(result.answer, /3% error rate/);
  assert.match(result.answer, /synthetic/);
});

test('unknown model-requested functions are rejected without executing', async () => {
  let attempt = 0;
  const fake: ModelClient = {
    async createResponse(request: ModelRequest): Promise<ModelResponse> {
      attempt += 1;
      if (attempt === 1) return { id: 'one', status: 'completed', output: [
        { type: 'function_call', call_id: 'a', name: 'delete_database', arguments: '{}' },
      ] };
      assert.ok(Array.isArray(request.input));
      const results = request.input as Array<{ output: string }>;
      assert.match(results[0]!.output, /not permitted/);
      return { id: 'two', status: 'completed', output: [
        { type: 'message', content: [{ type: 'output_text', text: 'I cannot execute that function.' }] },
      ] };
    },
  };
  const result = await runAgent(fake, 'Please delete a database.');
  assert.equal(result.trace[0]?.ok, false);
  assert.equal(result.rounds, 2);
});

test('invalid model-provided JSON is returned as a safe tool error', async () => {
  let attempt = 0;
  const fake: ModelClient = {
    async createResponse(request): Promise<ModelResponse> {
      if (++attempt === 1) return { id: 'bad', status: 'completed', output: [
        { type: 'function_call', call_id: 'badjson', name: 'get_service_status', arguments: '{oops' },
      ] };
      assert.ok(Array.isArray(request.input));
      assert.match((request.input as Array<{ output: string }>)[0]!.output, /Invalid JSON/);
      return { id: 'fixed', status: 'completed', output: [
        { type: 'message', content: [{ type: 'output_text', text: 'Unable to read tool arguments.' }] },
      ] };
    },
  };
  const result = await runAgent(fake, 'Investigate.');
  assert.equal(result.trace[0]?.ok, false);
});

test('agent stops if the model keeps requesting tools', async () => {
  let next = 0;
  const forever: ModelClient = {
    async createResponse(): Promise<ModelResponse> {
      next += 1;
      return { id: `loop-${next}`, status: 'completed', output: [
        { type: 'function_call', call_id: `call-${next}`, name: 'get_service_status', arguments: '{"service_id":"payments-api"}' },
      ] };
    },
  };
  await assert.rejects(() => runAgent(forever, 'Check.', { maxRounds: 2 }), /maximum of 2 rounds/);
});

test('malformed function call is not silently ignored', async () => {
  const malformed: ModelClient = {
    async createResponse(): Promise<ModelResponse> {
      return { id: 'broken', status: 'completed', output: [
        { type: 'function_call', name: 'get_service_status', arguments: '{}' },
      ] };
    },
  };
  await assert.rejects(() => runAgent(malformed, 'Check.'), /Malformed function call/);
});
