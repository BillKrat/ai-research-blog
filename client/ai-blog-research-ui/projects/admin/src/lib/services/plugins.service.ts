// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@adventures/core';

/** A built-in plug-in and whether it is on. */
export interface PluginState {
  key: string;
  title: string;
  description: string;
  version: string;
  priority: number;
  enabled: boolean;
  /** True when the plug-in declares settings, so its Customize screen exists. */
  hasSettings?: boolean;
}

/** One setting a plug-in declares, as its Customize screen shows it. */
export interface PluginSettingDefinition {
  name: string;
  label: string;
  description: string;
  kind: 'Text' | 'Lines' | 'Bool' | 'Number';
  default: string;
  maxLength: number;
}

/** A plug-in's declared settings and the value of each now (the default where none is saved). */
export interface PluginSettingsModel {
  definitions: PluginSettingDefinition[];
  values: Record<string, string>;
}

/** A plug-in that discovery loaded at start-up, and where it came from (assembly:Name or directory:File.dll). */
export interface LoadedPlugin {
  key: string;
  title: string;
  version: string;
  source: string;
}

/** A plug-in file or module that discovery refused, with the reason. */
export interface PluginLoadFailure {
  source: string;
  reason: string;
}

/** What plug-in discovery found at start-up. */
export interface PluginLoadReport {
  loaded: LoadedPlugin[];
  failures: PluginLoadFailure[];
}

/** The Plugins page's API: list the plug-ins, read the discovery report, switch one on or off (administrators only). */
@Injectable({ providedIn: 'root' })
export class PluginsService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  list(): Observable<PluginState[]> {
    return this.http.get<PluginState[]>(`${this.apiUrl}/api/plugins`);
  }

  getSettings(key: string): Observable<PluginSettingsModel> {
    return this.http.get<PluginSettingsModel>(`${this.apiUrl}/api/plugins/${encodeURIComponent(key)}/settings`);
  }

  saveSettings(key: string, values: Record<string, string>): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/plugins/${encodeURIComponent(key)}/settings`, { values });
  }

  loadReport(): Observable<PluginLoadReport> {
    return this.http.get<PluginLoadReport>(`${this.apiUrl}/api/plugins/load-report`);
  }

  setEnabled(key: string, enabled: boolean): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/plugins/${encodeURIComponent(key)}/${enabled ? 'enable' : 'disable'}`, {});
  }
}
