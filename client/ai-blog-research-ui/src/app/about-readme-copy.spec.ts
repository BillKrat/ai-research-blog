import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The About page serves a copy of the repository README (public/about.md); this keeps the copy from drifting. Copy the README over it when it changes. */
describe('the About page copy of the README', () => {
  it('is identical to the README at the repository root', () => {
    const readme = readFileSync(join(process.cwd(), '..', '..', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
    const copy = readFileSync(join(process.cwd(), 'public', 'about.md'), 'utf8').replace(/\r\n/g, '\n');

    expect(copy).toBe(readme);
  });
});
