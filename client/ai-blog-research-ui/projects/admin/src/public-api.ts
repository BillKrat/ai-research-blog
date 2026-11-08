/*
 * Public API Surface of @adventures/admin: the signed-in side of an Adventures app. The admin frame (menu from the server), the one list screen and one
 * entity screen that serve every collection, plugins, exceptions, the rights checklist, the sign-in and profile pages, and the services behind them.
 */

export * from './lib/services/admin-menu.service';
export * from './lib/services/admin-exceptions.service';
export * from './lib/services/health.service';
export * from './lib/services/plugins.service';
export * from './lib/services/roles-api.service';
export * from './lib/services/tenant.service';
export * from './lib/interceptors/server-error.interceptor';
export * from './lib/components/rights-checklist/rights-checklist';
export * from './lib/components/platform-switch/platform-switch';
export * from './lib/pages/admin-shell/admin-shell';
export * from './lib/pages/admin-grid/admin-grid';
export * from './lib/pages/admin-entity/admin-entity';
export * from './lib/pages/admin-plugins/admin-plugins';
export * from './lib/pages/admin-exceptions/admin-exceptions';
export * from './lib/pages/login/login';
export * from './lib/pages/profile/profile';
