import { ActivatedRouteSnapshot, Route } from '@angular/router';
import { legacyPostRedirect, routes } from './app.routes';

/**
 * Posts imported from BlogEngine.NET were linked as /post/yyyy/MM/dd/slug (and rated through /post/yyyy/MM/dd/slug/rate/n). Old links and bookmarks must land on the post,
 * not on an Angular "no route" error (seen in the live exception log: NG04002 for such addresses).
 */
describe('legacy BlogEngine post addresses', () => {
  const find = (path: string): Route | undefined => routes.find((r) => r.path === path);

  it('redirects /post/yyyy/MM/dd/slug to /post/slug', () => {
    const route = find('post/:year/:month/:day/:slug');
    expect(route).toBeDefined();
    expect(typeof route!.redirectTo).toBe('function');
    expect(legacyPostRedirect({ params: { year: '2026', month: '05', day: '25', slug: 'shiny-object-syndrome' } } as unknown as ActivatedRouteSnapshot)).toBe('/post/shiny-object-syndrome');
  });

  it('sends an old rating address to the post as well', () => {
    expect(find('post/:year/:month/:day/:slug/rate/:stars')).toBeDefined();
  });

  it.each([':blog/post/:year/:month/:day/:slug', ':blog/post/:year/:month/:day/:slug/rate/:stars'])(
    'redirects the address of a post in a named blog (%s), as one BlogEngine install holding several blogs linked it',
    (path) => {
      expect(find(path)?.redirectTo).toBe(legacyPostRedirect);
    },
  );

  it('keeps the plain /post/:slug route, which does not match four extra segments', () => {
    expect(find('post/:slug')).toBeDefined();
  });
});
