import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** Forgot my password: ask for a link (always answered the same), then choose a new password from the mailed link. */
@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  /** The link mailed points back at the address this page was opened at; the server checks it is one of its own. */
  request(identifier: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/password-reset/request`, { identifier, clientBase: window.location.origin });
  }

  reset(user: string, token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/password-reset/reset`, { user, token, newPassword });
  }
}
