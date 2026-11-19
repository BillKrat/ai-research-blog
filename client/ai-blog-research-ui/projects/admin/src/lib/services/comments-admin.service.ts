import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

/** A visitor comment as the moderator sees it. */
export interface ModerationComment {
  id: string;
  postSlug: string;
  postTitle: string;
  author: string;
  email: string | null;
  created: string;
  status: 'Pending' | 'Approved';
  body: string;
}

export type CommentAction = 'approve' | 'unapprove' | 'delete';

/** The Comments page's API: list (optionally one status), approve, unapprove and delete. Needs the comments.moderate right on the server. */
@Injectable({ providedIn: 'root' })
export class CommentsAdminService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  list(status: string | null): Observable<ModerationComment[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ModerationComment[]>(`${this.apiUrl}/api/comments`, { params });
  }

  process(action: CommentAction, ids: string[]): Observable<{ changed: number }> {
    return this.http.post<{ changed: number }>(`${this.apiUrl}/api/comments/process`, { action, ids });
  }
}
