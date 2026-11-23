import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** The address saved on the signed-in person's profile and whether they have proved it. */
export interface VerificationStatus {
  address: string;
  verified: boolean;
}

/** The e-mail address verification cycle: ask for a link mail, read the state, and (from the mailed link) confirm. */
@Injectable({ providedIn: 'root' })
export class EmailVerificationService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  status(): Observable<VerificationStatus> {
    return this.http.get<VerificationStatus>(`${this.apiUrl}/api/email-verification`);
  }

  /** Mails a link to the address saved on the profile; the link points back at the address this page was opened at. */
  request(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/email-verification/request`, { clientBase: window.location.origin });
  }

  confirm(user: string, token: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/email-verification/confirm`, { user, token });
  }
}
