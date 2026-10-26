import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** One right of the catalog: its stable name and what it lets a person do. */
export interface RightInfo {
  name: string;
  description: string;
}

/** The two role endpoints that are not part of the generic entity contract: the rights checklist and saving it. */
@Injectable({ providedIn: 'root' })
export class RolesApiService {
  private readonly http = inject(HttpClient);

  catalog(): Observable<RightInfo[]> {
    return this.http.get<RightInfo[]>(`${environment.apiUrl}/api/roles/rights-catalog`);
  }

  setRights(roleId: string, rights: string[]): Observable<{ rights: string[] }> {
    return this.http.put<{ rights: string[] }>(`${environment.apiUrl}/api/roles/${encodeURIComponent(roleId)}/rights`, { rights });
  }
}
