import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityFormModel, EntityGridModel } from '../models/entity-form.model';

/** What a grid asks of the server: sort and page size travel as query parameters on the collection URL. */
export interface GridQuery {
  sort?: string | null;
  descending?: boolean;
  pageSize?: number;
}

/**
 * The one thin client for every entity collection (users, roles, and whatever comes next). The only URL it has to be given
 * is the collection path of a screen ("/api/users"); every later URL (next page, a row form) is a link the server put in a
 * model and is followed as given. There is no per-entity service: a new entity type needs a route and a path, not a class.
 */
@Injectable({ providedIn: 'root' })
export class EntityApiService {
  private readonly http = inject(HttpClient);

  /** The first page of a collection, in the server's default order or sorted as asked (back to page 1). */
  grid(collectionPath: string, query: GridQuery = {}): Observable<EntityGridModel> {
    let params = new HttpParams();
    if (query.sort) {
      params = params.set('sort', query.sort).set('descending', String(query.descending === true));
    }
    if (query.pageSize) {
      params = params.set('pageSize', query.pageSize);
    }

    return this.http.get<EntityGridModel>(`${environment.apiUrl}${collectionPath}`, { params });
  }

  /** Follows a link from a grid model (next or previous page). */
  followGrid(link: string): Observable<EntityGridModel> {
    return this.http.get<EntityGridModel>(`${environment.apiUrl}${link}`);
  }

  /** The form of one entity, by a link the server supplied (or the collection path plus the id when the page was opened directly). */
  form(link: string): Observable<EntityFormModel> {
    return this.http.get<EntityFormModel>(`${environment.apiUrl}${link}`);
  }

  /** Saves the values of one entity form at its own endpoint. */
  update(link: string, entityId: string, values: Record<string, string | null>): Observable<EntityFormModel> {
    return this.http.put<EntityFormModel>(`${environment.apiUrl}${link}`, { entityId, values });
  }
}
