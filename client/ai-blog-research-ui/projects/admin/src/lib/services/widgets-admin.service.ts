import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';
import { PluginSettingDefinition } from './plugins.service';

/** A widget that can be placed: which plug-in owns it and what it is. */
export interface AvailableWidget {
  pluginKey: string;
  definition: { key: string; title: string; description: string; settings: PluginSettingDefinition[] | null };
}

/** One placement of a widget in a zone. `available` is false while the widget's plug-in is off or gone (the placement is kept). */
export interface WidgetPlacement {
  id: string;
  zone: string;
  widgetKey: string;
  title: string | null;
  settings: Record<string, string>;
  position: number;
  available: boolean;
}

export interface WidgetsOverview {
  zones: string[];
  available: AvailableWidget[];
  placements: WidgetPlacement[];
}

/** The Widgets screen's API (administrators with the site-settings right). */
@Injectable({ providedIn: 'root' })
export class WidgetsAdminService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  overview(): Observable<WidgetsOverview> {
    return this.http.get<WidgetsOverview>(`${this.apiUrl}/api/widgets`);
  }

  place(zone: string, widgetKey: string, title: string | null, settings: Record<string, string>): Observable<WidgetPlacement> {
    return this.http.post<WidgetPlacement>(`${this.apiUrl}/api/widgets/placements`, { zone, widgetKey, title, settings });
  }

  change(id: string, title: string | null, settings: Record<string, string>): Observable<WidgetPlacement> {
    return this.http.put<WidgetPlacement>(`${this.apiUrl}/api/widgets/placements/${encodeURIComponent(id)}`, { title, settings });
  }

  move(id: string, direction: -1 | 1): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/widgets/placements/${encodeURIComponent(id)}/move`, { direction });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/widgets/placements/${encodeURIComponent(id)}`);
  }
}
