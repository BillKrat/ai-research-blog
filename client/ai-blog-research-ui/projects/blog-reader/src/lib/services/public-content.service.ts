// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

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
  /** How content is written: Markdown (AI authors, older posts) or Html (the visual editor). The server has already cleaned Html. */
  contentFormat?: 'Markdown' | 'Html';
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
  contentFormat?: 'Markdown' | 'Html';
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
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  private readonly base = `${this.apiUrl}/api/public`;

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

  /** The front page, or null when none is pinned (the server answers 204 No Content, which is normal and logs nothing in the browser). */
  home(): Observable<PublicPage | null> {
    return this.http.get<PublicPage | null>(`${this.base}/home`);
  }

  /** Search of the published posts and pages (anonymous; the server limits the query and the rate). */
  search(query: string, page = 1, pageSize = 10): Observable<SearchResult> {
    const params = new HttpParams().set('q', query).set('page', page).set('pageSize', pageSize);
    return this.http.get<SearchResult>(`${this.base}/search`, { params });
  }

  menu(): Observable<PublicMenuItem[]> {
    return this.http.get<PublicMenuItem[]>(`${this.base}/menu`);
  }

  categories(): Observable<PublicTerm[]> {
    return this.http.get<PublicTerm[]>(`${this.base}/categories`);
  }

  /** The approved comments under a post, oldest first. */
  comments(slug: string): Observable<PublicComment[]> {
    return this.http.get<PublicComment[]>(`${this.base}/posts/${encodeURIComponent(slug)}/comments`);
  }

  /** Sends a new comment; it waits for approval before anyone sees it. */
  submitComment(slug: string, comment: CommentSubmission): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/posts/${encodeURIComponent(slug)}/comments`, comment);
  }

  /** Whether the Contact plug-in is on (for the CONTACT link) and the text above its form. */
  contact(): Observable<ContactInfo> {
    return this.http.get<ContactInfo>(`${this.base}/contact`);
  }

  /** Sends a message to the owner by e-mail (rate limited by the server). */
  sendContact(message: ContactSubmission): Observable<unknown> {
    return this.http.post(`${this.base}/contact`, message);
  }

  tags(): Observable<PublicTerm[]> {
    return this.http.get<PublicTerm[]>(`${this.base}/tags`);
  }
}

/** What the site needs of the Contact plug-in: whether it is on, and the text above the form. The recipient is never sent to a browser. */
export interface ContactInfo {
  enabled: boolean;
  intro: string;
}

/** What the contact form sends. `website` is a hidden field only a robot fills in. */
export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  website: string;
}

/** An approved comment: no id and no e-mail address ever reach a reader. */
export interface PublicComment {
  author: string;
  created: string;
  body: string;
}

/** What the comment form sends. `website` is a hidden field only a robot fills in. */
export interface CommentSubmission {
  author: string;
  email: string;
  body: string;
  website: string;
}

/** One search hit: a post or a page with a short plain-text snippet. */
export interface SearchHit {
  kind: 'post' | 'page';
  slug: string;
  title: string;
  snippet: string;
  datePublished: string | null;
}

export interface SearchResult {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  hits: SearchHit[];
}
