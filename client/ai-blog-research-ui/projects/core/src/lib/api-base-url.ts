import { InjectionToken } from '@angular/core';

/**
 * Where the API lives: a scheme and host with no trailing slash ("https://api.example.com"), or the empty string for the page's own origin
 * (development, behind the proxy). The host app supplies it once; nothing that talks to the API reads an environment file, so the same services
 * work in any app (S10).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { providedIn: 'root', factory: () => '' });
