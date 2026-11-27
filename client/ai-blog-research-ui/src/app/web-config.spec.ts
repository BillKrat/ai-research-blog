import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * public/web.config ships with the client, so every deploy of a static IIS web site carries its own rules and no hand-made file on the
 * host is needed. The rules are evaluated here the way IIS URL Rewrite reads them (first matching rule wins, all conditions must hold),
 * which covers only what this file uses.
 */
const path = join(process.cwd(), 'public', 'web.config');

interface Request {
  url: string;
  host?: string;
  https?: boolean;
  forwardedProto?: string;
  isFile?: boolean;
}

function config(): Document {
  return new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'application/xml');
}

/** What the rewrite rules do with a request: redirect to an address, serve another file, or serve what was asked for. */
function handle(request: Request): string {
  const { url, host = 'www.example.com', https = true, forwardedProto = '', isFile = false } = request;
  const inputs: Record<string, string> = {
    '{HTTPS}': https ? 'on' : 'off',
    '{HTTP_HOST}': host,
    '{HTTP_X_FORWARDED_PROTO}': forwardedProto,
    '{REQUEST_URI}': url,
  };
  const matches = (element: Element, value: string) =>
    new RegExp(element.getAttribute('pattern') ?? element.getAttribute('url')!, 'i').test(value) !== (element.getAttribute('negate') === 'true');

  for (const rule of Array.from(config().querySelectorAll('rewrite > rules > rule'))) {
    if (!matches(rule.querySelector('match')!, url.split('?')[0].replace(/^\//, ''))) {
      continue;
    }
    const holds = Array.from(rule.querySelectorAll('conditions > add')).every((condition) => {
      if (condition.getAttribute('matchType') === 'IsFile') {
        return isFile !== (condition.getAttribute('negate') === 'true');
      }
      const input = condition.getAttribute('input')!;
      expect(Object.keys(inputs)).toContain(input);
      return matches(condition, inputs[input]);
    });
    if (holds) {
      const action = rule.querySelector('action')!;
      if (action.getAttribute('type') === 'CustomResponse') {
        return `status ${action.getAttribute('statusCode')}`;
      }
      const target = action.getAttribute('url')!.replace('{HTTP_HOST}', host).replace('{REQUEST_URI}', url);
      return `${action.getAttribute('type')!.toLowerCase()} ${target}`;
    }
  }
  return 'serve';
}

describe('the web.config shipped with the client', () => {
  it('is in public/, so the build copies it beside index.html, and is well-formed', () => {
    expect(existsSync(path)).toBe(true);
    expect(config().querySelector('parsererror')).toBeNull();
  });

  it.each(['/admin/posts', '/post/a-post', '/post/old-address.aspx', '/post/version-1.5', '/setup', '/api-is-not-here'])(
    'answers the deep link %s with the application page',
    (url) => {
      expect(handle({ url })).toBe('rewrite /index.html');
    },
  );

  it('serves a file that exists as it is', () => {
    expect(handle({ url: '/main-ABC123.js', isFile: true })).toBe('serve');
  });

  it.each(['/Adventures/image.axd?picture=2016%2fa.png', '/blogai/file.axd', '/image.axd', '/syndication.AXD'])(
    'answers the old BlogEngine address %s with not found, so the application never loads for it',
    (url) => {
      expect(handle({ url })).toBe('status 404');
    },
  );

  it('leaves a post whose address only mentions .axd to the application', () => {
    expect(handle({ url: '/post/what-is-an.axd-handler' })).toBe('rewrite /index.html');
  });

  it.each(['/chunk-gone.js', '/styles-gone.css', '/media/gone.woff2', '/chunk-gone.js?v=2', '/OnTheEdge/Images/HeadBang.gif', '/pics/old.JPG', '/a.jpeg', '/b.png'])(
    'lets a missing asset %s be a 404 instead of the application page',
    (url) => {
      expect(handle({ url })).toBe('serve');
    },
  );

  it('sends a plain http visitor to https, keeping the path and query', () => {
    expect(handle({ url: '/post/a-post?x=1', https: false })).toBe('redirect https://www.example.com/post/a-post?x=1');
    expect(handle({ url: '/main-ABC123.js', https: false, isFile: true })).toBe('redirect https://www.example.com/main-ABC123.js');
  });

  it('does not redirect behind a proxy that already received https (no redirect loop)', () => {
    expect(handle({ url: '/', https: false, forwardedProto: 'https' })).toBe('rewrite /index.html');
  });

  it.each(['localhost', 'localhost:8080', '127.0.0.1', 'account-001-site1.atempurl.com', 'account-001-site2.dtempurl.com', 'account-001-site8.ftempurl.com'])(
    'leaves plain http alone on %s, which may have no certificate',
    (host) => {
      expect(handle({ url: '/', host, https: false })).toBe('rewrite /index.html');
    },
  );

  it('does not exempt a domain that only looks like a temporary address', () => {
    expect(handle({ url: '/', host: 'x.dtempurl.com.example.com', https: false })).toBe('redirect https://x.dtempurl.com.example.com/');
  });

  it.each([true, false])('never touches the certificate challenge folder (file exists: %s)', (isFile) => {
    expect(handle({ url: '/.well-known/acme-challenge/token', https: false, isFile })).toBe('serve');
  });

  it('makes browsers revalidate files, so a new deploy shows up on the next page load', () => {
    expect(config().querySelector('staticContent > clientCache')?.getAttribute('cacheControlMode')).toBe('DisableCache');
  });

  it('names the type of the About page file, replacing any inherited mapping', () => {
    const staticContent = config().querySelector('staticContent')!;
    expect(staticContent.querySelector('remove[fileExtension=".md"]')).not.toBeNull();
    expect(staticContent.querySelector('mimeMap[fileExtension=".md"]')?.getAttribute('mimeType')).toContain('text/markdown');
  });

  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'SAMEORIGIN'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'geolocation=(), camera=(), microphone=()'],
  ])('sends %s, replacing any inherited value', (name, value) => {
    const headers = config().querySelector('httpProtocol > customHeaders')!;
    expect(headers.querySelector(`remove[name="${name}"]`)).not.toBeNull();
    expect(headers.querySelector(`add[name="${name}"]`)?.getAttribute('value')).toBe(value);
  });

  it('is only a static site configuration: no application settings, connection strings or server modules', () => {
    const root = config().documentElement;
    expect(Array.from(root.children).map((child) => child.tagName)).toEqual(['system.webServer']);
    expect(Array.from(root.children[0].children).map((child) => child.tagName).sort()).toEqual(['httpProtocol', 'rewrite', 'staticContent']);
  });

  it('is left out of the single-site build, where the API serves the client and has its own web.config', () => {
    const workflow = readFileSync(join(process.cwd(), '..', '..', '.github', 'workflows', 'deploy-single.yml'), 'utf8');
    expect(workflow).toContain('rm publish/wwwroot/web.config');
  });
});
