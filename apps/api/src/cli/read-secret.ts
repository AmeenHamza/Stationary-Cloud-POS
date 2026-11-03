import { createInterface } from 'node:readline';

/**
 * Reads a secret without echoing it: from a TTY prompt, or the first line of piped stdin. Secrets are
 * never taken from command-line arguments (they would land in shell history and process lists).
 */
export async function readSecret(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    let data = '';
    for await (const chunk of input) {
      data += String(chunk);
    }
    return data.split(/\r?\n/)[0] ?? '';
  }
  process.stdout.write(prompt);
  const reader = createInterface({ input, terminal: true });
  // Swallow the echo of typed characters; readline still collects them.
  (reader as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () =>
    undefined;
  const answer = await new Promise<string>((resolve) => {
    reader.question('', resolve);
  });
  reader.close();
  process.stdout.write('\n');
  return answer;
}
