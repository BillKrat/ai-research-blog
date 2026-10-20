import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
  },
  {
    // Administrators only on the server (403 otherwise); the guard just keeps anonymous visitors on the sign-in page.
    path: 'admin/users',
    loadComponent: () => import('./pages/admin-users/admin-users').then((m) => m.AdminUsers),
    canActivate: [authGuard],
  },
  {
    // Administrators only on the server (403 otherwise); the guard just keeps anonymous visitors on the sign-in page.
    path: 'admin/exceptions',
    loadComponent: () => import('./pages/admin-exceptions/admin-exceptions').then((m) => m.AdminExceptions),
    canActivate: [authGuard],
  },
];
