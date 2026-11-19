import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

export interface DashboardItem {
  id: string;
  title: string;
}

/** What the Dashboard shows: counts, the drafts, and what waits for a person. */
export interface DashboardModel {
  publishedPosts: number;
  draftPosts: number;
  publishedPages: number;
  draftPages: number;
  exceptions: number;
  collaborationWaiting: number;
  commentsPending: number;
  draftPostList: DashboardItem[];
  draftPageList: DashboardItem[];
}

/** The Dashboard's one read-only call (administrators only; the server decides). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  load(): Observable<DashboardModel> {
    return this.http.get<DashboardModel>(`${this.apiUrl}/api/admin/dashboard`);
  }
}
