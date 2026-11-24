import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

/** The Maintenance screen's calls (administrators with the site-settings right). */
@Injectable({ providedIn: 'root' })
export class MaintenanceAdminService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  /** A JSON backup of posts and pages, as a file. */
  exportContent(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/export/content`, { responseType: 'blob' });
  }

  clearCache(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/cache/clear`, {});
  }
}
