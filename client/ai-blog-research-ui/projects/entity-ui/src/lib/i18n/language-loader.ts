import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';
import { LabelService } from './labels';

interface PublicLabels {
  language: unknown;
  labels: unknown;
}

/**
 * Reads the table of texts of the site language (an administrator picks it in Settings and keeps the files under Admin > Languages) and hands it to
 * <see cref="LabelService"/>. Anonymous; a failure or an answer that is not a table leaves English in place, so the screens never wait on it.
 */
@Injectable({ providedIn: 'root' })
export class LanguageLoader {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  private readonly labels = inject(LabelService);

  load(): Observable<void> {
    return this.http.get<PublicLabels>(`${this.apiUrl}/api/public/labels`).pipe(
      map((answer) => {
        const table = answer?.labels;
        if (typeof answer?.language === 'string' && table !== null && typeof table === 'object' && !Array.isArray(table)) {
          this.labels.load(answer.language, table as Record<string, string>);
        }
      }),
      catchError(() => of(undefined)),
    );
  }
}
