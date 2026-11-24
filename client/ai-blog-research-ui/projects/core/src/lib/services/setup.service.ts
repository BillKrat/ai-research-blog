import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** Whether this address needs setting up. The server names no site here. */
export interface SetupStatus {
  host: string;
  needsSetup: boolean;
}

export interface SetupToken {
  accessToken: string;
  expiresAtUtc: string;
}

export interface SetupSite {
  id: string;
  name: string;
  domain: string;
}

/**
 * The setup of an address that reaches no site (onboarding stage 3). The setup token is held by the page only (never stored, never the normal sign-in) and sent explicitly:
 * it is accepted by the setup API alone.
 */
@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  status(): Observable<SetupStatus> {
    return this.http.get<SetupStatus>(`${this.api}/api/setup/status`);
  }

  signIn(site: string, userName: string, password: string): Observable<SetupToken> {
    return this.http.post<SetupToken>(`${this.api}/api/setup/token`, { site, userName, password });
  }

  sites(token: string): Observable<SetupSite[]> {
    return this.http.get<SetupSite[]>(`${this.api}/api/setup/sites`, { headers: this.bearer(token) });
  }

  attach(token: string, tenantId: string): Observable<unknown> {
    return this.http.post(`${this.api}/api/setup/attach`, { tenantId }, { headers: this.bearer(token) });
  }

  newSite(token: string, name: string): Observable<unknown> {
    return this.http.post(`${this.api}/api/setup/new`, { name }, { headers: this.bearer(token) });
  }

  private bearer(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
