// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { authGuard } from '@adventures/core';

/**
 * One list screen and one entity screen serve every collection: the route data names the collection and the title, the
 * server supplies the rest. Paths are relative to the admin shell.
 */
const adminCollection = (path: string, collection: string, title: string): Routes => [
  {
    path,
    loadComponent: () => import('@adventures/admin').then((m) => m.AdminGrid),
    data: { collection, title },
  },
  {
    path: `${path}/:id`,
    loadComponent: () => import('@adventures/admin').then((m) => m.AdminEntity),
    data: { collection, title },
  },
];

/** The post address BlogEngine.NET used, /post/yyyy/MM/dd/slug, becomes the current one, /post/slug (the date in the path is dropped). */
export const legacyPostRedirect = (route: Pick<ActivatedRouteSnapshot, 'params'>): string => `/post/${encodeURIComponent(route.params['slug'])}`;

export const routes: Routes = [
  // The public site (anonymous): home (the front page, else a welcome), posts, one post, one page, a category, a tag.
  { path: '', pathMatch: 'full', loadComponent: () => import('@adventures/blog-reader').then((m) => m.PageView), data: { front: true } },
  { path: 'posts', loadComponent: () => import('@adventures/blog-reader').then((m) => m.PostList), data: { kind: 'all' } },
  { path: 'post/:year/:month/:day/:slug', redirectTo: legacyPostRedirect },
  { path: 'post/:year/:month/:day/:slug/rate/:stars', redirectTo: legacyPostRedirect },
  { path: 'post/:slug', loadComponent: () => import('@adventures/blog-reader').then((m) => m.PostView) },
  { path: 'page/:slug', loadComponent: () => import('@adventures/blog-reader').then((m) => m.PageView) },
  { path: 'search', loadComponent: () => import('@adventures/blog-reader').then((m) => m.SearchPage) },
  { path: 'category/:name', loadComponent: () => import('@adventures/blog-reader').then((m) => m.PostList), data: { kind: 'category' } },
  { path: 'tag/:name', loadComponent: () => import('@adventures/blog-reader').then((m) => m.PostList), data: { kind: 'tag' } },
  { path: 'setup', loadComponent: () => import('@adventures/admin').then((m) => m.Setup) },
  { path: 'verify-email', loadComponent: () => import('@adventures/admin').then((m) => m.VerifyEmail) },
  { path: 'forgot-password', loadComponent: () => import('@adventures/admin').then((m) => m.ForgotPassword) },
  { path: 'reset-password', loadComponent: () => import('@adventures/admin').then((m) => m.ResetPassword) },
  { path: 'login', loadComponent: () => import('@adventures/admin').then((m) => m.Login) },
  {
    path: 'profile',
    loadComponent: () => import('@adventures/admin').then((m) => m.Profile),
    canActivate: [authGuard],
  },
  {
    // The Test steps of one collaboration item on a bare page, for the pop-out window (no admin frame).
    path: 'steps/:id',
    loadComponent: () => import('@adventures/collaboration').then((m) => m.TestStepsPopout),
    canActivate: [authGuard],
  },
  {
    // The admin area: the frame renders the server-supplied menu; every screen inside is administrators only on the server
    // (403 otherwise), the guard only keeps anonymous visitors on the sign-in page.
    path: 'admin',
    loadComponent: () => import('@adventures/admin').then((m) => m.AdminShell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('@adventures/admin').then((m) => m.AdminDashboard) },
      { path: 'comments', loadComponent: () => import('@adventures/admin').then((m) => m.AdminComments) },
      { path: 'about', loadComponent: () => import('@adventures/admin').then((m) => m.AdminAbout) },
      ...adminCollection('users', '/api/users', 'Users'),
      ...adminCollection('roles', '/api/roles', 'Roles'),
      ...adminCollection('posts', '/api/posts', 'Posts'),
      ...adminCollection('collaboration', '/api/collaboration', 'Collaboration'),
      ...adminCollection('pages', '/api/pages', 'Pages'),
      ...adminCollection('categories', '/api/categories', 'Categories'),
      { path: 'tags', loadComponent: () => import('@adventures/admin').then((m) => m.AdminTags) },
      ...adminCollection('tags', '/api/tags', 'Tags'),
      { path: 'settings', pathMatch: 'full', loadComponent: () => import('@adventures/admin').then((m) => m.AdminSettings) },
      ...adminCollection('settings/all', '/api/settings', 'Settings'),
      { path: 'plugins', loadComponent: () => import('@adventures/admin').then((m) => m.AdminPlugins) },
      { path: 'plugins/:key', loadComponent: () => import('@adventures/admin').then((m) => m.AdminPluginCustomize) },
      { path: 'widgets', loadComponent: () => import('@adventures/admin').then((m) => m.AdminWidgets) },
      { path: 'languages', loadComponent: () => import('@adventures/admin').then((m) => m.AdminLanguages) },
      { path: 'maintenance', loadComponent: () => import('@adventures/admin').then((m) => m.AdminMaintenance) },
      { path: 'tenants', loadComponent: () => import('@adventures/admin').then((m) => m.AdminTenants) },
      { path: 'decisions', loadComponent: () => import('@adventures/collaboration').then((m) => m.AdminDecisions) },
      { path: 'exceptions', loadComponent: () => import('@adventures/admin').then((m) => m.AdminExceptions) },
    ],
  },
];
