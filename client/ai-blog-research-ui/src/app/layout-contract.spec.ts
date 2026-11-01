import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Component styles cannot be measured in the unit-test DOM, so the few declarations that keep a wide table from pushing the page (and its buttons) off the
 * screen are pinned here by name. Found by a real run: the Roles list, whose Rights cell is one long comma list, widened the whole admin page.
 */
const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8').replace(/\s+/g, ' ');

describe('layout contract', () => {
  it('lets the admin content column shrink below its widest cell (minmax(0, 1fr), not 1fr)', () => {
    const shell = read('projects/admin/src/lib/pages/admin-shell/admin-shell.scss');
    expect(shell).toContain('grid-template-columns: 14rem minmax(0, 1fr)');
  });

  it('wraps long cell text inside the grid instead of widening it', () => {
    const grid = read('projects/entity-ui/src/lib/components/entity-grid/entity-grid.scss');
    // `anywhere` (unlike `break-word`) also lowers the cell's minimum width, so one long comma list can no longer widen the table
    expect(grid).toMatch(/td \{[^}]*overflow-wrap: anywhere/);
  });

  it('drops the reading-width limit in the admin area only', () => {
    const app = read('src/app/app.scss');
    expect(app).toMatch(/&--wide\s*\{\s*max-width: none/);
  });
});
