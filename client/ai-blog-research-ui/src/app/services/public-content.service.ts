// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PublicPostSummary {
  title: string;
  slug: string;
  description: string | null;
  datePublished: string | null;
  author: string | null;
  categories: string[];
  tags: string[];
  /** True only in an administrator's view: the post is not published. */
  isDraft?: boolean;
  /** The review state of a collaboration post (administrator's view only). */
  approval?: string | null;
}

export interface PublicPost {
  summary: PublicPostSummary;
  content: string;
  enableComments: boolean;
}

export interface PublicPage {
  title: string;
  slug: string;
  description: string | null;
  content: string;
  datePublished: string | null;
  parentTitle: string | null;
  parentSlug: string | null;
  isDraft?: boolean;
}

export interface PublicMenuItem {
  title: string;
  slug: string;
  children: PublicMenuItem[];
  isDraft?: boolean;
}

export interface PublicPostList {
  posts: PublicPostSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicTerm {
  name: string;
  posts: number;
}

/** The anonymous read side of the site: published posts and pages only. Nothing here needs a token or can change anything. */
@Injectable({ providedIn: 'root' })
export class PublicContentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/public`;

  posts(page = 1, pageSize = 10, category?: string | null, tag?: string | null): Observable<PublicPostList> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (category) {
      params = params.set('category', category);
    }
    if (tag) {
      params = params.set('tag', tag);
    }

    return this.http.get<PublicPostList>(`${this.base}/posts`, { params });
  }

  post(slug: string): Observable<PublicPost> {
    return this.http.get<PublicPost>(`${this.base}/posts/${encodeURIComponent(slug)}`);
  }

  page(slug: string): Observable<PublicPage> {
    return this.http.get<PublicPage>(`${this.base}/pages/${encodeURIComponent(slug)}`);
  }

  /** The front page; the server answers 404 when none is set. */
  home(): Observable<PublicPage> {
    return this.http.get<PublicPage>(`${this.base}/home`);
  }

  menu(): Observable<PublicMenuItem[]> {
    return this.http.get<PublicMenuItem[]>(`${this.base}/menu`);
  }

  categories(): Observable<PublicTerm[]> {
    return this.http.get<PublicTerm[]>(`${this.base}/categories`);
  }

  tags(): Observable<PublicTerm[]> {
    return this.http.get<PublicTerm[]>(`${this.base}/tags`);
  }
}
