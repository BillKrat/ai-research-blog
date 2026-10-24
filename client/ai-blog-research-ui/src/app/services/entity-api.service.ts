// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityDataModel, EntityFormModel, EntityGridModel } from '../models/entity-form.model';

/** One choice of a pointer field: the id to store and the text to show. */
export interface LookupOption {
  id: string;
  text: string;
}

/** What a grid asks of the server: sort and page size travel as query parameters on the collection URL. */
export interface GridQuery {
  sort?: string | null;
  descending?: boolean;
  pageSize?: number;
  filter?: string | null;
  filterValue?: string | null;
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
    if (query.filter && query.filterValue) {
      params = params.set('filter', query.filter).set('filterValue', query.filterValue);
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

  /** The choices for a pointer field, from a lookup link the server supplied. */
  lookup(link: string): Observable<LookupOption[]> {
    return this.http.get<LookupOption[]>(`${environment.apiUrl}${link}`);
  }

  /** Adds a child to a relation (POST to the create link the server supplied); the child own endpoint validates it. */
  addChild(createLink: string, child: EntityDataModel): Observable<EntityDataModel> {
    return this.http.post<EntityDataModel>(`${environment.apiUrl}${createLink}`, child);
  }

  /** Removes a child by the row link the server supplied. */
  removeChild(rowLink: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${rowLink}`);
  }

  /** Creates an entity (POST to the create link the server supplied); the server answers with the created form. */
  create(createLink: string, values: Record<string, string | null>): Observable<EntityFormModel> {
    return this.http.post<EntityFormModel>(`${environment.apiUrl}${createLink}`, { entityId: '', values });
  }

  /** Deletes an entity by its own link (the server tombstones it). */
  remove(link: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${link}`);
  }

  /** The id of the entry with this slug in a collection that has one (posts, pages): lets the public reader link to the admin screens. */
  idBySlug(collectionPath: string, slug: string): Observable<{ id: string }> {
    return this.http.get<{ id: string }>(`${environment.apiUrl}${collectionPath}/by-slug/${encodeURIComponent(slug)}`);
  }

  /** Runs a server-offered action on an entity (publish, unpublish): a POST to the link the server supplied. */
  runAction<T = void>(link: string): Observable<T> {
    return this.http.post<T>(`${environment.apiUrl}${link}`, {});
  }
}
