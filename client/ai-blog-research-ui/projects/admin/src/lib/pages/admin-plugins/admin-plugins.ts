// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { describeApiError, bindSpinner } from '@adventures/core';
import { AdminMenuService } from '../../services/admin-menu.service';
import { PageHeader } from '../../components/page-header/page-header';
import { PluginLoadReport, PluginState, PluginsService } from '../../services/plugins.service';

/**
 * The Plugins page: the built-in plug-ins (Developer Collaboration, Research Collaboration, Decisions) with a switch each. A plug-in that is
 * switched off disappears from the admin menu and its endpoints refuse; its data is kept. The menu is read again after every change.
 */
@Component({
  selector: 'adv-admin-plugins',
  imports: [PageHeader],
  templateUrl: './admin-plugins.html',
  styleUrl: './admin-plugins.scss',
})
export class AdminPlugins implements OnInit {
  private readonly api = inject(PluginsService);
  private readonly menu = inject(AdminMenuService);

  protected readonly plugins = signal<PluginState[]>([]);
  protected readonly report = signal<PluginLoadReport>({ loaded: [], failures: [] });

  /** True while the HTML sanitising plug-in is switched off: anyone who can edit a post could then run script for every visitor of this site. */
  protected readonly sanitiserOff = computed(() => this.plugins().some((p) => p.key === 'html-sanitizer' && !p.enabled));
  protected readonly errors = signal<string[]>([]);
  protected readonly isLoading = signal(true);
  private readonly gears = bindSpinner(this.isLoading);
  protected readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  toggle(plugin: PluginState, enabled: boolean): void {
    if (this.busy()) {
      return;
    }

    this.busy.set(plugin.key);
    this.errors.set([]);
    this.api.setEnabled(plugin.key, enabled).subscribe({
      next: () => {
        this.busy.set(null);
        this.plugins.update((all) => all.map((p) => (p.key === plugin.key ? { ...p, enabled } : p)));
        this.menu.load();
      },
      error: (error) => {
        this.busy.set(null);
        this.errors.set(describeApiError(error, "Couldn't change the plug-in."));
      },
    });
  }

  private load(): void {
    // The discovery report is separate: if it cannot be read the plug-ins are still listed, with a message.
    this.api.loadReport().subscribe({
      next: (report) => this.report.set(report),
      error: (error) => this.errors.update((all) => [...all, ...describeApiError(error, "Couldn't load the plug-in discovery report.")]),
    });
    this.api.list().subscribe({
      next: (all) => {
        this.plugins.set(all);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(describeApiError(error, "Couldn't load the plug-ins."));
      },
    });
  }
}
