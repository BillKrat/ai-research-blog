// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { REQUEST_TIMEOUT_MS } from '../interceptors/timeout.interceptor';

/** An uploaded image: where it is served from and the Markdown that shows it. */
export interface MediaItem {
  id: string;
  name: string;
  contentType: string;
  length: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
  markdown: string;
}

/** Uploads an image for a post or page (administrators only; the server accepts PNG, JPEG, GIF and WebP up to 5 MB and checks the bytes). */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  upload(file: File): Observable<MediaItem> {
    const form = new FormData();
    form.append('file', file, file.name);
    // a large image over a slow link takes longer than an ordinary call
    return this.http.post<MediaItem>(`${this.apiUrl}/api/media`, form, { context: new HttpContext().set(REQUEST_TIMEOUT_MS, 60_000) });
  }
}
