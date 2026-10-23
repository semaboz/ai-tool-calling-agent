import assert from 'node:assert/strict';
import test from 'node:test';
import { executeTool, toolDefinitions } from '../src/tools.ts';

test('all model tool definitions use strict object schemas', () => {
  for (const tool of toolDefinitions) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
    assert.deepEqual([...tool.parameters.required].sort(), Object.keys(tool.parameters.properties).sort());
  }
});

test('service status returns synthetic metrics', async () => {
  const result = await executeTool('get_service_status', { service_id: 'payments-api' });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.status, 'degraded');
});

test('search incidents only returns matching records', async () => {
  const result = await executeTool('search_incidents', { query: 'payments', limit: 3 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.count, 2);
});

test('calculates 3 percent accurately', async () => {
  const result = await executeTool('calculate_error_rate', { total_requests: 1200, failed_requests: 36 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.error_rate_percent, 3);
});

test('rejects invalid request totals', async () => {
  const result = await executeTool('calculate_error_rate', { total_requests: 3, failed_requests: 4 });
  assert.equal(result.ok, false);
});

test('rejects extra arguments and unknown tools', async () => {
  const extra = await executeTool('get_service_status', { service_id: 'payments-api', shell: 'rm -rf /' });
  const unknown = await executeTool('run_shell', { command: 'echo hi' });
  assert.equal(extra.ok, false);
  assert.equal(unknown.ok, false);
});
