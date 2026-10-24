// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
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
