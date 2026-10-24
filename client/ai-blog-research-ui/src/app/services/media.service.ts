// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private readonly http = inject(HttpClient);

  upload(file: File): Observable<MediaItem> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MediaItem>(`${environment.apiUrl}/api/media`, form);
  }
}
