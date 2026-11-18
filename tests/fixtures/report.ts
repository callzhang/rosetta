export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function fixtureReport(name: string) {
  const output = document.querySelector<HTMLElement>('#result');
  assert(output, 'Missing fixture result element');
  const lines: string[] = [];
  return {
    pass(message: string) {
      lines.push(`PASS ${message}`);
      output.textContent = lines.join('\n');
    },
    complete() {
      document.title = `PASS · ${name}`;
    },
    fail(error: unknown) {
      output.textContent += `\nFAIL ${
        error instanceof Error ? error.stack || error.message : String(error)
      }`;
      document.title = `FAIL · ${name}`;
    },
  };
}
