import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from './app.routes';

/** The recovery page (a code and a file on the host) is the way back in when there is no e-mail: the sign-in page and the setup page must both lead to it. */
describe('the recovery page', () => {
  it('is a route', () => {
    expect(routes.find((r) => r.path === 'recover')).toBeDefined();
  });

  it.each(['login/login.html', 'setup/setup.html'])('is linked from %s', (file) => {
    const html = readFileSync(join(process.cwd(), 'projects/admin/src/lib/pages', file), 'utf8');

    expect(html).toContain('routerLink="/recover"');
  });
});
