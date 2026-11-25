/*
 * Public API Surface of @adventures/admin: the signed-in side of an Adventures app. The admin frame (menu from the server), the one list screen and one
 * entity screen that serve every collection, plugins, exceptions, the rights checklist, the sign-in and profile pages, and the services behind them.
 */

export * from './lib/services/plugins.service';
export * from './lib/services/roles-api.service';
export * from './lib/services/tenant.service';
export * from './lib/components/rights-checklist/rights-checklist';
export * from './lib/components/platform-switch/platform-switch';
export * from './lib/pages/admin-shell/admin-shell';
export * from './lib/pages/admin-grid/admin-grid';
export * from './lib/pages/admin-entity/admin-entity';
export * from './lib/pages/admin-plugins/admin-plugins';
export * from './lib/pages/admin-plugin-customize/admin-plugin-customize';
export * from './lib/services/widgets-admin.service';
export * from './lib/pages/admin-widgets/admin-widgets';
export * from './lib/components/setting-fields/setting-fields';
export * from './lib/pages/admin-exceptions/admin-exceptions';
export * from './lib/pages/admin-dashboard/admin-dashboard';
export * from './lib/components/health-pill/health-pill';
export * from './lib/pages/admin-comments/admin-comments';
export * from './lib/services/comments-admin.service';
export * from './lib/services/dashboard.service';
export * from './lib/components/tenant-panel/tenant-panel';
export * from './lib/pages/admin-tenants/admin-tenants';
export * from './lib/pages/login/login';
export * from './lib/pages/profile/profile';
export * from './lib/pages/admin-tags/admin-tags';
export * from './lib/services/languages-admin.service';
export * from './lib/pages/admin-languages/admin-languages';
export * from './lib/services/mail-admin.service';
export * from './lib/services/maintenance-admin.service';
export * from './lib/pages/admin-maintenance/admin-maintenance';
export * from './lib/pages/setup/setup';
export * from './lib/pages/verify-email/verify-email';
export * from './lib/pages/forgot-password/forgot-password';
export * from './lib/pages/reset-password/reset-password';
export * from './lib/components/email-verification-panel/email-verification-panel';
export * from './lib/pages/admin-about/admin-about';
export * from './lib/pages/admin-settings/admin-settings';
