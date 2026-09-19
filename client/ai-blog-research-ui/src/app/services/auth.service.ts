import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TokenResponse {
  accessToken: string;
  expiresAtUtc: string;
}

const TOKEN_STORAGE_KEY = 'auth.accessToken';
const EXPIRY_STORAGE_KEY = 'auth.expiresAtUtc';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _accessToken = signal<string | null>(sessionStorage.getItem(TOKEN_STORAGE_KEY));
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = () => !!this._accessToken() && !this.isExpired();

  login(userName: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.apiUrl}/api/auth/token`, { userName, password })
      .pipe(
        tap((response) => {
          this._accessToken.set(response.accessToken);
          sessionStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
          sessionStorage.setItem(EXPIRY_STORAGE_KEY, response.expiresAtUtc);
        }),
      );
  }

  logout(): void {
    this._accessToken.set(null);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRY_STORAGE_KEY);
  }

  private isExpired(): boolean {
    const expiresAtUtc = sessionStorage.getItem(EXPIRY_STORAGE_KEY);
    if (!expiresAtUtc) {
      return true;
    }
    return new Date(expiresAtUtc).getTime() <= Date.now();
  }
}
