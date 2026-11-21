import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

/** One widget of a zone as the server rendered it: its title and its HTML (already cleaned by the server's sanitiser plug-in). */
export interface RenderedWidget {
  id: string;
  widgetKey: string;
  title: string;
  html: string;
}

/** Reads the widgets of a zone (header, left, right, footer) from the public API. */
@Injectable({ providedIn: 'root' })
export class WidgetsService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  zone(zone: string): Observable<RenderedWidget[]> {
    return this.http.get<RenderedWidget[]>(`${this.apiUrl}/api/public/widgets/${encodeURIComponent(zone)}`);
  }
}
