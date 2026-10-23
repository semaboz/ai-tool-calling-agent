import { existsSync } from 'node:fs';
import { runAgent } from './agent.ts';
import { DemoModelClient, ResponsesHttpClient } from './clients.ts';

// Node 22+ loads local environment variables without a dependency.
if (existsSync('.env')) process.loadEnvFile('.env');

const args = process.argv.slice(2);
const demoMode = args.includes('--demo');
const help = args.includes('--help') || args.includes('-h');
const prompt = args.filter((arg) => !arg.startsWith('--')).join(' ') ||
  'Investigate the health of payments-api and calculate its error rate.';

if (help) {
  console.log(`Usage:\n  npm start (scripted, offline)\n  npm run live -- "Investigate payments-api"\n\nOptional live mode: configure OPENAI_API_KEY in .env (may incur charges).`);
} else {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!demoMode && (!apiKey || apiKey === 'replace_with_your_api_key')) {
      throw new Error('Live mode requires OPENAI_API_KEY in .env. Use npm start for the free offline demo.');
    }
    const client = demoMode ? new DemoModelClient() : new ResponsesHttpClient(apiKey!);
    console.log(`Mode: ${demoMode ? 'offline demo (no LLM)' : 'live Responses API'}\nPrompt: ${prompt}\n`);
    const result = await runAgent(client, prompt, {
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      onToolResult: (record) => {
        console.log(`[tool] ${record.tool} | ${record.ok ? 'ok' : 'error'} | ${record.durationMs}ms`);
      },
    });
    console.log(`\nAnswer:\n${result.answer}\n\nCompleted in ${result.rounds} model round(s) with ${result.trace.length} tool call(s).`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exitCode = 1;
  }
}
