/** A small transport-neutral subset of the OpenAI Responses API. */
export type JsonObject = Record<string, unknown>;

export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  strict: true;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

export interface FunctionCall {
  type: 'function_call';
  name: string;
  call_id: string;
  arguments: string;
}

export type ResponseOutputItem = Record<string, unknown> & { type: string };

export interface ModelResponse {
  id: string;
  status: string;
  output: ResponseOutputItem[];
  output_text?: string;
  error?: unknown;
  incomplete_details?: unknown;
}

export interface FunctionCallResult {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

export interface ModelRequest {
  model: string;
  instructions: string;
  input: string | FunctionCallResult[];
  tools: ToolDefinition[];
  previous_response_id?: string;
}

export interface ModelClient {
  createResponse(request: ModelRequest): Promise<ModelResponse>;
}

export interface ToolTrace {
  tool: string;
  callId: string;
  ok: boolean;
  durationMs: number;
  result: JsonObject;
}

export interface AgentResult {
  answer: string;
  rounds: number;
  trace: ToolTrace[];
}
