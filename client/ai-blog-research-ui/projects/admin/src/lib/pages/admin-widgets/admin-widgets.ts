import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { describeApiError, bindSpinner } from '@adventures/core';
import { PageHeader } from '../../components/page-header/page-header';
import { SettingFields } from '../../components/setting-fields/setting-fields';
import { AvailableWidget, WidgetPlacement, WidgetsAdminService, WidgetsOverview } from '../../services/widgets-admin.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

const ZONE_NAMES: Record<string, string> = { header: 'Header', left: 'Left', right: 'Right', footer: 'Footer' };

/**
 * The Widgets page, as in BlogEngine.NET: the four zones of the public page (header, left, right, footer) with the widgets placed in each, and what
 * can be placed. Add a widget to a zone, move it up or down, edit its title and the settings it declared, or remove it. A placement whose plug-in is
 * switched off keeps its place and is marked, and returns when the plug-in is switched on. A phone shows only the header and footer zones.
 */
@Component({
  selector: 'adv-admin-widgets',
  imports: [PageHeader, SettingFields, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-widgets.html',
  styleUrl: './admin-widgets.scss',
})
export class AdminWidgets implements OnInit {
  private readonly api = inject(WidgetsAdminService);

  protected readonly overview = signal<WidgetsOverview>({ zones: [], available: [], placements: [] });
  protected readonly errors = signal<string[]>([]);
  protected readonly isLoading = signal(true);
  private readonly gears = bindSpinner(this.isLoading);
  /** True while a change is on its way and the layout is being read again: the controls are disabled and the global spinner turns. */
  protected readonly busy = signal(false);
  private readonly busyGears = bindSpinner(this.busy);
  protected readonly choice = signal<Record<string, string>>({});
  protected readonly editing = signal<WidgetPlacement | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editSettings = signal<Record<string, string>>({});
  protected readonly editDefinitions = computed(() => this.definitionOf(this.editing()?.widgetKey)?.definition.settings ?? []);

  ngOnInit(): void {
    this.load();
  }

  protected zoneName(zone: string): string {
    return ZONE_NAMES[zone] ?? zone;
  }

  protected inZone(zone: string): WidgetPlacement[] {
    return this.overview()
      .placements.filter((p) => p.zone === zone)
      .sort((a, b) => a.position - b.position);
  }

  protected nameOf(placement: WidgetPlacement): string {
    return placement.title || this.definitionOf(placement.widgetKey)?.definition.title || placement.widgetKey;
  }

  protected choose(zone: string, widgetKey: string): void {
    this.choice.update((all) => ({ ...all, [zone]: widgetKey }));
  }

  protected add(zone: string): void {
    const widgetKey = this.choice()[zone];
    if (!widgetKey) {
      return;
    }

    this.run(this.api.place(zone, widgetKey, null, {}), () => this.choice.update((all) => ({ ...all, [zone]: '' })));
  }

  protected move(placement: WidgetPlacement, direction: -1 | 1): void {
    this.run(this.api.move(placement.id, direction));
  }

  protected remove(placement: WidgetPlacement): void {
    this.run(this.api.remove(placement.id), () => this.editing.update((open) => (open?.id === placement.id ? null : open)));
  }

  protected edit(placement: WidgetPlacement): void {
    this.editing.set(placement);
    this.editTitle.set(placement.title ?? '');
    this.editSettings.set({ ...placement.settings });
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected save(): void {
    const open = this.editing();
    if (!open) {
      return;
    }

    this.run(this.api.change(open.id, this.editTitle(), this.editSettings()), () => this.editing.set(null));
  }

  protected setSetting(name: string, value: string): void {
    this.editSettings.update((all) => ({ ...all, [name]: value }));
  }

  private definitionOf(widgetKey: string | undefined): AvailableWidget | undefined {
    return this.overview().available.find((w) => w.definition.key === widgetKey);
  }

  /** Runs a change, then reads the layout again; a refusal shows its reason and changes nothing on screen. */
  private run(request: Observable<unknown>, after?: () => void): void {
    this.errors.set([]);
    this.busy.set(true);
    request.subscribe({
      next: () => {
        after?.();
        this.load();
      },
      error: (error) => {
        this.busy.set(false);
        this.errors.set(describeApiError(error, "Couldn't change the widgets."));
      },
    });
  }

  private load(): void {
    this.api.overview().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.isLoading.set(false);
        this.busy.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.busy.set(false);
        this.errors.set(describeApiError(error, "Couldn't load the widgets."));
      },
    });
  }
}
