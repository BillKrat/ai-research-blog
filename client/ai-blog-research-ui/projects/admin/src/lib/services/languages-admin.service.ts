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

  /** The texts the server itself produces (menu names and so on) with their English defaults: more keys a language file can translate. */
  catalog(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.apiUrl}/api/languages/catalog`);
  }

  /** The files Claude proposed through MCP, waiting for review: nothing is served until one is saved here. */
  proposals(): Observable<LanguageSummary[]> {
    return this.http.get<LanguageSummary[]>(`${this.apiUrl}/api/languages/proposals`);
  }

  readProposal(language: string): Observable<LanguageTable> {
    return this.http.get<LanguageTable>(`${this.apiUrl}/api/languages/${encodeURIComponent(language)}/proposal`);
  }

  discardProposal(language: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/languages/${encodeURIComponent(language)}/proposal`);
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
