import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { describeApiError, bindSpinner } from '@adventures/core';
import { PageHeader } from '../../components/page-header/page-header';
import { SettingFields } from '../../components/setting-fields/setting-fields';
import { PluginSettingDefinition, PluginsService } from '../../services/plugins.service';

/**
 * A plug-in's Customize screen: one field for each setting the plug-in declares (text, one value per line, a switch or a number), filled with
 * the current value. The form is built from the declared definitions, so a new plug-in gets its screen with no client change. A refused value
 * comes back with the plug-in's own reason and nothing is saved.
 */
@Component({
  selector: 'adv-admin-plugin-customize',
  imports: [PageHeader, RouterLink, SettingFields],
  templateUrl: './admin-plugin-customize.html',
  styleUrl: './admin-plugin-customize.scss',
})
export class AdminPluginCustomize implements OnInit {
  private readonly api = inject(PluginsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly key = this.route.snapshot.paramMap.get('key') ?? '';
  protected readonly definitions = signal<PluginSettingDefinition[]>([]);
  protected readonly values = signal<Record<string, string>>({});
  protected readonly secretsSet = signal<string[]>([]);
  protected readonly clearing = signal<string[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly saved = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  private readonly gears = bindSpinner(this.isLoading);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.getSettings(this.key).subscribe({
      next: (model) => {
        this.definitions.set(model.definitions);
        this.values.set({ ...model.values });
        this.secretsSet.set(model.secretsSet ?? []);
        this.clearing.set([]);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(error?.status === 404 ? ['This plug-in has no settings to customize.'] : describeApiError(error, "Couldn't load the settings."));
      },
    });
  }

  protected clearSecret(name: string): void {
    this.saved.set(false);
    this.clearing.update((all) => (all.includes(name) ? all : [...all, name]));
    this.values.update((all) => ({ ...all, [name]: '' }));
  }

  protected set(name: string, value: string): void {
    this.saved.set(false);
    this.values.update((all) => ({ ...all, [name]: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.errors.set([]);
    this.saved.set(false);
    this.api.saveSettings(this.key, this.values(), this.clearing()).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.set(true);
        this.load(); // a secret is never sent back, so ask again what is set
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errors.set(describeApiError(error, "Couldn't save the settings."));
      },
    });
  }
}
