import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

/** A stored language and how many texts its file holds. */
export interface LanguageSummary {
  language: string;
  count: number;
}

export interface LanguageTable {
  language: string;
  labels: Record<string, string>;
}

/** The language files' API (administrators with the site-settings right). */
@Injectable({ providedIn: 'root' })
export class LanguagesAdminService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  list(): Observable<LanguageSummary[]> {
    return this.http.get<LanguageSummary[]>(`${this.apiUrl}/api/languages`);
  }

  read(language: string): Observable<LanguageTable> {
    return this.http.get<LanguageTable>(`${this.apiUrl}/api/languages/${encodeURIComponent(language)}`);
  }

  save(language: string, labels: Record<string, string>): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/languages/${encodeURIComponent(language)}`, { labels });
  }

  remove(language: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/languages/${encodeURIComponent(language)}`);
  }
}
