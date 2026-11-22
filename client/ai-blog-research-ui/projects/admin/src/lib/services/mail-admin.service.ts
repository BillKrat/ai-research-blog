import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

/** The E-mail plug-in's test call (administrators with the site-settings right): one test message to the address given. */
@Injectable({ providedIn: 'root' })
export class MailAdminService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  sendTest(to: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/mail/test`, { to });
  }
}
