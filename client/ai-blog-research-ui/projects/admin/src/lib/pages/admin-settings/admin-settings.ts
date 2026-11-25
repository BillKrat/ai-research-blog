import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { API_BASE_URL, EntityDataModel, EntityGridModel, bindSpinner, describeApiError } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';
import { SettingFields } from '../../components/setting-fields/setting-fields';
import { PluginSettingDefinition } from '../../services/plugins.service';

const field = (name: string, label: string, description: string, kind: PluginSettingDefinition['kind'], def: string, maxLength = 200): PluginSettingDefinition => ({
  name,
  label,
  description,
  kind,
  default: def,
  maxLength,
});

/** One tab of the Settings screen, as the legacy Settings pages group them. E-mail has no stored settings here: it is the e-mail plug-in's own screen. */
export interface SettingGroup {
  id: string;
  label: string;
  fields: PluginSettingDefinition[];
  /** Where the group's settings live when they are not site settings. */
  link?: string;
}

/** The known site settings by group. A setting the server has no row for is created by the server when the plain list is opened. */
export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'basic',
    label: 'Basic',
    fields: [
      field('SiteTitle', 'Site title', 'The name shown in the header and the browser tab.', 'Text', 'AI Research Blog'),
      field('Tagline', 'Tagline', 'A short line under the title (optional).', 'Text', ''),
      field('PostsPerPage', 'Posts per page', 'How many posts the list shows on a page (1 to 50).', 'Number', '10', 3),
      field('Language', 'Language', 'A language code such as en, de or pt-br; the texts come from that language file.', 'Text', 'en', 10),
      field('ColorMode', 'Colour mode', 'The look every visitor starts with: dark or light.', 'Text', 'dark', 10),
    ],
  },
  { id: 'email', label: 'E-mail', fields: [], link: '/admin/plugins/mail' },
  { id: 'feed', label: 'Feed', fields: [field('FeedItems', 'Feed items', 'How many of the newest posts the RSS feed lists (1 to 100).', 'Number', '20', 3)] },
  {
    id: 'comments',
    label: 'Comments',
    fields: [
      field('CommentsEnabled', 'Enable comments', 'Show the comment form where a post allows comments; off hides it and refuses new comments (existing ones are kept).', 'Bool', 'true', 5),
      field('CommentsModerate', 'Moderate comments', 'Hold every new visitor comment until a moderator approves it.', 'Bool', 'true', 5),
      field('CommentsCloseAfterDays', 'Close comments after (days)', 'Close comments on a post this many days after it was published (0 keeps them open).', 'Number', '0', 4),
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    fields: [
      field('TimeZone', 'Time zone', 'The time zone the legacy BlogEngine dates were written in (for the migration).', 'Text', 'UTC'),
      field('TrackingScriptUrl', 'Tracking script address', 'One https address of an analytics script for the public pages; only hosts the operator allowed work. Empty for none.', 'Text', '', 300),
    ],
  },
];

/**
 * The Settings screen grouped as the legacy blog groups it (Basic, E-mail, Feed, Comments, Advanced), one field per setting with the right kind of input.
 * It reads and writes the same site-setting rows as the plain list, which stays reachable, so no setting is lost or renamed here.
 */
@Component({
  selector: 'adv-admin-settings',
  imports: [PageHeader, RouterLink, SettingFields, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/settings`;

  protected readonly groups = SETTING_GROUPS;
  protected readonly current = signal(SETTING_GROUPS[0].id);
  protected readonly group = computed(() => SETTING_GROUPS.find((g) => g.id === this.current()) ?? SETTING_GROUPS[0]);
  protected readonly errors = signal<string[]>([]);
  protected readonly saved = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly values = signal<Record<string, string>>({});
  private readonly gears = bindSpinner(this.isLoading);

  private rows = new Map<string, EntityDataModel>();
  private original: Record<string, string> = {};

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const params = new HttpParams().set('pageSize', '100');
    this.http.get<EntityGridModel>(this.url, { params }).subscribe({
      next: (grid) => {
        this.rows = new Map(grid.rows.map((row) => [row.values['Name'] ?? '', row]));
        const values: Record<string, string> = {};
        for (const definition of SETTING_GROUPS.flatMap((g) => g.fields)) {
          values[definition.name] = this.rows.get(definition.name)?.values['Value'] ?? definition.default;
        }

        this.original = { ...values };
        this.values.set(values);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(describeApiError(error, 'Could not load the settings.'));
      },
    });
  }

  protected select(id: string): void {
    this.current.set(id);
  }

  protected set(name: string, value: string): void {
    this.saved.set(false);
    this.values.update((all) => ({ ...all, [name]: value }));
  }

  /** Saves only what changed, and only settings that have a row (the plain list creates the missing rows). */
  protected save(event: Event): void {
    event.preventDefault();
    if (this.isSaving()) {
      return;
    }

    const values = this.values();
    const changed = Object.keys(values).filter((name) => values[name] !== this.original[name] && this.rows.has(name));
    this.errors.set([]);
    this.saved.set(false);
    if (changed.length === 0) {
      this.saved.set(true);
      return;
    }

    this.isSaving.set(true);
    const requests = changed.map((name) => {
      const row = this.rows.get(name)!;
      const body: EntityDataModel = { entityId: row.entityId, values: { ...row.values, Value: values[name] } };
      return this.http.put(`${this.url}/${row.entityId}`, body);
    });
    forkJoin(requests).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.set(true);
        this.load();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errors.set(describeApiError(error, 'Could not save the settings.'));
      },
    });
  }
}
