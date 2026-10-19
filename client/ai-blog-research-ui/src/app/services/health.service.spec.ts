import { describeFailures } from './health.service';

describe('describeFailures', () => {
  it('names each failed dependency with its code', () => {
    expect(
      describeFailures({
        dependencies: [
          { name: 'mcp', status: 'failed', durationMs: 5, detail: 'timeout' },
          { name: 'database', status: 'ok', durationMs: 3, detail: 'ok' },
        ],
      }),
    ).toBe('mcp (timeout)');
  });

  it('is empty when everything is ok or nothing was reported', () => {
    expect(describeFailures({ dependencies: [{ name: 'mcp', status: 'ok', durationMs: 1, detail: 'ok' }] })).toBe('');
    expect(describeFailures({})).toBe('');
  });
});
