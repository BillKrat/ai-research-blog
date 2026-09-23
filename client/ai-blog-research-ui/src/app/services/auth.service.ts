import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TokenResponse {
  accessToken: string;
  expiresAtUtc: string;
  mustChangePassword: boolean;
}

const TOKEN_STORAGE_KEY = 'auth.accessToken';
const EXPIRY_STORAGE_KEY = 'auth.expiresAtUtc';
const USERNAME_STORAGE_KEY = 'auth.username';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _accessToken = signal<string | null>(sessionStorage.getItem(TOKEN_STORAGE_KEY));
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = () => !!this._accessToken() && !this.isExpired();

  // The JWT's `sub` claim is the user's GUID, not their username - see
  // docs/SESSION_HANDOFF.md's 2026-09-23 "NEXT UP" entry, gap 1. Rather than decode the JWT
  // client-side (fragile - the username claim lands under a long XML-namespace URI key, an
  // Adventures.Security implementation detail this client shouldn't depend on), this fetches
  // GET /api/auth/whoami right after login, which already resolves it server-side. Zero backend
  // changes needed - the chosen alternative (adding UserName to TokenResponse) would have required
  // a new Adventures.Identity method/package version just for this.
  private readonly _username = signal<string | null>(sessionStorage.getItem(USERNAME_STORAGE_KEY));
  readonly username = this._username.asReadonly();

  // Surfaced so nothing silently drops it (see gap 2 in the same entry), but no forced-password-
  // change flow acts on it yet - deferred twice already per docs/SESSION_HANDOFF.md's 2026-09-19/21
  // entries, not re-decided here.
  private readonly _mustChangePassword = signal(false);
  readonly mustChangePassword = this._mustChangePassword.asReadonly();

  login(userName: string, password: string): Observable<string> {
    return this.http
      .post<TokenResponse>(`${environment.apiUrl}/api/auth/token`, { userName, password })
      .pipe(
        tap((response) => {
          this._accessToken.set(response.accessToken);
          this._mustChangePassword.set(response.mustChangePassword);
          sessionStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
          sessionStorage.setItem(EXPIRY_STORAGE_KEY, response.expiresAtUtc);
        }),
        switchMap(() => this.http.get(`${environment.apiUrl}/api/auth/whoami`, { responseType: 'text' })),
        tap((username) => {
          this._username.set(username);
          sessionStorage.setItem(USERNAME_STORAGE_KEY, username);
        }),
      );
  }

  logout(): void {
    this._accessToken.set(null);
    this._username.set(null);
    this._mustChangePassword.set(false);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRY_STORAGE_KEY);
    sessionStorage.removeItem(USERNAME_STORAGE_KEY);
  }

  private isExpired(): boolean {
    const expiresAtUtc = sessionStorage.getItem(EXPIRY_STORAGE_KEY);
    if (!expiresAtUtc) {
      return true;
    }
    return new Date(expiresAtUtc).getTime() <= Date.now();
  }
}
