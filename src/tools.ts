import { incidents, services } from './data.ts';
import type { JsonObject, ToolDefinition } from './types.ts';

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validateKeys(value: unknown, required: readonly string[]): JsonObject {
  if (!isObject(value)) throw new ToolInputError('Arguments must be a JSON object.');
  const supplied = Object.keys(value);
  if (supplied.some((key) => !required.includes(key)) || required.some((key) => !(key in value))) {
    throw new ToolInputError(`Expected exactly these keys: ${required.join(', ')}.`);
  }
  return value;
}

function boundedString(value: unknown, name: string, maxLength = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new ToolInputError(`${name} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function boundedInteger(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ToolInputError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function', name: 'get_service_status',
    description: 'Read the status and synthetic metrics for a named service.', strict: true,
    parameters: {
      type: 'object',
      properties: { service_id: { type: 'string', enum: services.map((item) => item.id) } },
      required: ['service_id'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'search_incidents',
    description: 'Search synthetic incident records by service name, ID, or summary text.', strict: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search phrase' },
        limit: { type: 'integer', description: 'Maximum matching results (1 through 10)' },
      },
      required: ['query', 'limit'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'calculate_error_rate',
    description: 'Calculate a failure percentage from request counts; use data returned by get_service_status.', strict: true,
    parameters: {
      type: 'object',
      properties: {
        total_requests: { type: 'integer' },
        failed_requests: { type: 'integer' },
      },
      required: ['total_requests', 'failed_requests'], additionalProperties: false,
    },
  },
];

export type ToolResult = { ok: true; data: JsonObject } | { ok: false; error: string };

/** Explicit allowlist: a model cannot execute arbitrary functions or shell commands. */
export async function executeTool(name: string, args: unknown): Promise<ToolResult> {
  try {
    if (name === 'get_service_status') {
      const input = validateKeys(args, ['service_id']);
      const serviceId = boundedString(input.service_id, 'service_id');
      const service = services.find((item) => item.id === serviceId);
      if (!service) return { ok: false, error: 'Unknown service ID.' };
      return { ok: true, data: { ...service, note: 'Synthetic demo data; not live telemetry.' } };
    }
    if (name === 'search_incidents') {
      const input = validateKeys(args, ['query', 'limit']);
      const query = boundedString(input.query, 'query').toLowerCase();
      const limit = boundedInteger(input.limit, 'limit', 1, 10);
      const matches = incidents.filter((incident) =>
        [incident.id, incident.serviceId, incident.summary, incident.severity, incident.state]
          .some((field) => field.toLowerCase().includes(query)),
      ).slice(0, limit);
      return { ok: true, data: { results: [...matches], count: matches.length } };
    }
    if (name === 'calculate_error_rate') {
      const input = validateKeys(args, ['total_requests', 'failed_requests']);
      const total = boundedInteger(input.total_requests, 'total_requests', 1, 1_000_000_000);
      const failed = boundedInteger(input.failed_requests, 'failed_requests', 0, total);
      return { ok: true, data: { total_requests: total, failed_requests: failed, error_rate_percent: Math.round((failed / total) * 10_000) / 100 } };
    }
    return { ok: false, error: `Tool '${name}' is not permitted.` };
  } catch (error) {
    if (error instanceof ToolInputError) return { ok: false, error: error.message };
    // Do not leak internal errors, filesystem paths, or secrets into a model response.
    return { ok: false, error: 'Tool execution failed.' };
  }
}
