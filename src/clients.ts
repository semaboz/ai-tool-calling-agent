import type { ModelClient, ModelRequest, ModelResponse } from './types.ts';

/** Optional, real model transport. The offline demo never instantiates this client. */
export class ResponsesHttpClient implements ModelClient {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKey: string, endpoint = 'https://api.openai.com/v1/responses') {
    if (!apiKey.trim()) throw new Error('Missing API key.');
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async createResponse(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      // Avoid echoing provider responses, which can contain sensitive request details.
      throw new Error(`Model API returned HTTP ${response.status}. Check API access and configuration.`);
    }

    const body: unknown = await response.json();
    if (!isModelResponse(body)) throw new Error('Unexpected model API response.');
    return body;
  }
}

function isModelResponse(value: unknown): value is ModelResponse {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.status === 'string'
    && Array.isArray(value.output)
    && value.output.every((item: unknown) => isRecord(item) && typeof item.type === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse only successful tool outputs; don't trust the transport's JSON shape. */
function toolData(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value) && value.ok === true && isRecord(value.data)) return value.data;
  } catch {
    // A malformed tool output is unavailable data, not an instruction.
  }
  return undefined;
}

function message(id: string, text: string): ModelResponse {
  return {
    id,
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  };
}

/**
 * Deterministic offline *mock*, not an AI model. It emits a scripted tool sequence
 * and builds the final answer from returned tool data rather than fixed metrics.
 * The supplied prompt is intentionally not interpreted in demo mode.
 */
export class DemoModelClient implements ModelClient {
  private round = 0;
  private readonly outputs = new Map<string, string>();

  async createResponse(request: ModelRequest): Promise<ModelResponse> {
    if (Array.isArray(request.input)) {
      for (const item of request.input) this.outputs.set(item.call_id, item.output);
    }
    this.round += 1;

    if (this.round === 1) {
      return {
        id: 'demo_1', status: 'completed', output: [
          { type: 'function_call', call_id: 'call_1', name: 'get_service_status', arguments: JSON.stringify({ service_id: 'payments-api' }) },
          { type: 'function_call', call_id: 'call_2', name: 'search_incidents', arguments: JSON.stringify({ query: 'payments', limit: 3 }) },
        ],
      };
    }

    const status = toolData(this.outputs.get('call_1'));
    const incidents = toolData(this.outputs.get('call_2'));

    if (this.round === 2) {
      if (typeof status?.requests !== 'number' || typeof status.failures !== 'number') {
        return message('demo_2', 'DEMO (no LLM): Service metrics were unavailable; error rate was not calculated.');
      }
      return {
        id: 'demo_2', status: 'completed', output: [
          { type: 'function_call', call_id: 'call_3', name: 'calculate_error_rate', arguments: JSON.stringify({ total_requests: status.requests, failed_requests: status.failures }) },
        ],
      };
    }

    const rate = toolData(this.outputs.get('call_3'));
    const state = typeof status?.status === 'string' ? status.status : 'unknown';
    const total = typeof status?.requests === 'number' ? status.requests.toLocaleString('en-US') : '?';
    const failed = typeof status?.failures === 'number' ? status.failures.toLocaleString('en-US') : '?';
    const rateText = typeof rate?.error_rate_percent === 'number' ? `${rate.error_rate_percent}% error rate` : 'error rate unavailable';
    const incidentIds = Array.isArray(incidents?.results)
      ? incidents.results.filter(isRecord).map((item) => item.id).filter((id): id is string => typeof id === 'string')
      : [];
    const incidentText = incidentIds.length ? `Matching incident IDs: ${incidentIds.join(', ')}.` : 'No matching incidents found.';

    return message(`demo_${this.round}`,
      `DEMO (scripted calls, no LLM): payments-api is ${state} in a synthetic dataset. ` +
      `${failed} failures out of ${total} requests (${rateText}). ${incidentText} No external actions were taken.`);
  }
}
