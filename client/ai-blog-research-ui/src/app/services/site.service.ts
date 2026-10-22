import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';

/** What the browser needs of the site settings (an administrator edits them under Admin > Settings). */
export interface SiteSettings {
  title: string;
  tagline: string;
  postsPerPage: number;
}

const DEFAULTS: SiteSettings = { title: 'AI Research Blog', tagline: '', postsPerPage: 10 };

/**
 * The site title, tagline and page size from the anonymous <c>/api/public/site</c>. Read once and shared; a failure falls back to the
 * defaults so the site never waits on it. <see cref="refresh"/> reads it again (after an administrator changed a setting).
 */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly http = inject(HttpClient);
  private request: Observable<SiteSettings> | null = null;

  readonly settings = signal<SiteSettings>(DEFAULTS);

  /** The settings, loaded on first use and then served from memory. */
  get(): Observable<SiteSettings> {
    this.request ??= this.http.get<SiteSettings>(`${environment.apiUrl}/api/public/site`).pipe(
      tap((loaded) => this.settings.set(loaded)),
      catchError(() => of(this.settings())),
      shareReplay(1),
    );
    return this.request;
  }

  refresh(): void {
    this.request = null;
    this.get().subscribe();
  }
}
