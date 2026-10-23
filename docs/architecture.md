# Architecture notes

## Scope

This repository demonstrates the orchestration layer around model-generated function calls. The default offline model is a **deterministic scripted mock**. All service metrics and incident records are synthetic.

## Responsibilities

- `ModelClient` (`types.ts`) defines a small transport-independent model interface.
- `DemoModelClient` (`clients.ts`) emits scripted tool-call requests and formats a final message using the returned results. It is not a language model.
- `ResponsesHttpClient` (`clients.ts`) is an **optional** network transport for an actual Responses API request.
- `runAgent` (`agent.ts`) runs a loop: request model response, validate function calls, execute tools, pass their results back, and stop when a text answer arrives.
- `executeTool` (`tools.ts`) validates the tool name and its inputs before reading the synthetic data in `data.ts`.

## Tool-calling sequence

```text
User prompt
   |
   v
runAgent -> ModelClient -> function_call(name, arguments, call_id)
   |                           |
   +---------------------------+
   |
   v
Validate JSON -> Allowlisted tool -> Structured result
   |
   v
function_call_output(call_id, result) -> ModelClient
   |
   v
Final text response -> CLI
```

## Safety and trade-offs

1. **No arbitrary execution:** only three read-only tools are allowed.
2. **Runtime checks:** tool inputs are checked even though schema metadata is provided to a model.
3. **Call correlation:** output is matched to each request with `call_id`, including multiple calls in a single round.
4. **Ordering:** concurrency is safe for these read-only tools, and tool outputs and traces preserve request order.
5. **Bounded loops:** there is a maximum number of model rounds and calls per round.
6. **Demo limitations:** the offline client does not interpret the prompt or make model decisions. Real model behavior cannot be inferred from demo success.
7. **Non-goals:** persistence, streaming, retry/backoff, credentials management, authorization by user, and real observability are outside this portfolio exercise.

## Potential extensions

- External model evaluation cases, with expected tool sequences and answer checks.
- Structured logging and per-tool timeouts.
- Error handling for API rate limits and transient failures.
- Provider-independent model adapters.
