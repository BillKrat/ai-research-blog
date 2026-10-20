import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

/**
 * Administrators only on the server (403 otherwise); the guard only keeps anonymous visitors on the sign-in page. One list
 * screen and one entity screen serve every collection: the route data names the collection and the title, the server
 * supplies the rest.
 */
const adminCollection = (path: string, collection: string, title: string): Routes => [
  {
    path,
    loadComponent: () => import('./pages/admin-grid/admin-grid').then((m) => m.AdminGrid),
    canActivate: [authGuard],
    data: { collection, title },
  },
  {
    path: `${path}/:id`,
    loadComponent: () => import('./pages/admin-entity/admin-entity').then((m) => m.AdminEntity),
    canActivate: [authGuard],
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
  ...adminCollection('admin/users', '/api/users', 'Users'),
  ...adminCollection('admin/roles', '/api/roles', 'Roles'),
  {
    path: 'admin/exceptions',
    loadComponent: () => import('./pages/admin-exceptions/admin-exceptions').then((m) => m.AdminExceptions),
    canActivate: [authGuard],
  },
];
