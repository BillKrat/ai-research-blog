import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityGridModel } from '../models/entity-form.model';

/** What the Users grid asks of the server: sort and page size travel as query parameters on the collection URL. */
export interface UserGridQuery {
  sort?: string | null;
  descending?: boolean;
  pageSize?: number;
}

/**
 * The administrator's Users list. The one URL the client has to know is the collection ("/api/users"); every later URL
 * (next page, previous page, self) is a link the server put in the grid model, followed as given. Administrators only on
 * the server (403 otherwise).
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  /** The single entry point; the server supplies every other URL. */
  static readonly CollectionPath = '/api/users';

  private readonly http = inject(HttpClient);

  /** The first page, in the server's default order, or sorted as asked (back to page 1). */
  first(query: UserGridQuery = {}): Observable<EntityGridModel> {
    let params = new HttpParams();
    if (query.sort) {
      params = params.set('sort', query.sort).set('descending', String(query.descending === true));
    }
    if (query.pageSize) {
      params = params.set('pageSize', query.pageSize);
    }

    return this.http.get<EntityGridModel>(`${environment.apiUrl}${AdminUsersService.CollectionPath}`, { params });
  }

  /** Follows a link from a grid model (next or previous page). */
  follow(link: string): Observable<EntityGridModel> {
    return this.http.get<EntityGridModel>(`${environment.apiUrl}${link}`);
  }
}
