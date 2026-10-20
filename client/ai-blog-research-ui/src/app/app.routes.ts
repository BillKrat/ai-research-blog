import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

/**
 * One list screen and one entity screen serve every collection: the route data names the collection and the title, the
 * server supplies the rest. Paths are relative to the admin shell.
 */
const adminCollection = (path: string, collection: string, title: string): Routes => [
  {
    path,
    loadComponent: () => import('./pages/admin-grid/admin-grid').then((m) => m.AdminGrid),
    data: { collection, title },
  },
  {
    path: `${path}/:id`,
    loadComponent: () => import('./pages/admin-entity/admin-entity').then((m) => m.AdminEntity),
    data: { collection, title },
  },
];

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
  },
  {
    // The admin area: the frame renders the server-supplied menu; every screen inside is administrators only on the server
    // (403 otherwise), the guard only keeps anonymous visitors on the sign-in page.
    path: 'admin',
    loadComponent: () => import('./pages/admin-shell/admin-shell').then((m) => m.AdminShell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      ...adminCollection('users', '/api/users', 'Users'),
      ...adminCollection('roles', '/api/roles', 'Roles'),
      ...adminCollection('posts', '/api/posts', 'Posts'),
      ...adminCollection('pages', '/api/pages', 'Pages'),
      ...adminCollection('categories', '/api/categories', 'Categories'),
      ...adminCollection('tags', '/api/tags', 'Tags'),
      { path: 'exceptions', loadComponent: () => import('./pages/admin-exceptions/admin-exceptions').then((m) => m.AdminExceptions) },
    ],
  },
];
