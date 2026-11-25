import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** A one-time recovery challenge: create a file named <code>fileName</code> in the folder <code>folder</code> (App_Data) on the host before it expires. */
export interface RecoveryChallenge {
  code: string;
  fileName: string;
  folder: string;
  expiresAtUtc: string;
}

/**
 * Recovery without e-mail: ask for a code, put a file named with it on the host (FTP, the hosting panel's file manager), then choose a new password. Only someone who
 * controls the installation can do the second step, which is the whole point.
 */
@Injectable({ providedIn: 'root' })
export class RecoveryService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  start(): Observable<RecoveryChallenge> {
    return this.http.post<RecoveryChallenge>(`${this.api}/api/recovery/start`, {});
  }

  complete(code: string, site: string, userName: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.api}/api/recovery/complete`, { code, site, userName, newPassword });
  }
}
