import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RenderedWidget, WidgetsService } from '../../services/widgets.service';

/**
 * One widget zone of the public page (header, left, right or footer): the widgets the owner placed there, each with its title and its HTML.
 * The HTML comes from the server, which has already passed it through the sanitiser plug-in; whether it is cleaned, or left as written because the
 * owner switched sanitising off, is the server's decision, so it is shown as given. An empty or failing zone draws nothing and never shows an error:
 * a widget must not be able to break the page.
 */
@Component({
  selector: 'adv-widget-zone',
  templateUrl: './widget-zone.html',
  styleUrl: './widget-zone.scss',
  host: {
    '[class.widget-zone--empty]': 'empty()',
    '[attr.data-zone]': 'zone()',
    '(click)': 'follow($event)',
  },
})
export class WidgetZone implements OnInit {
  private readonly api = inject(WidgetsService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly zone = input.required<string>();

  protected readonly widgets = signal<{ id: string; title: string; html: SafeHtml }[]>([]);
  protected readonly empty = computed(() => this.widgets().length === 0);

  ngOnInit(): void {
    this.api.zone(this.zone()).subscribe({
      next: (all: RenderedWidget[]) =>
        this.widgets.set(all.map((w) => ({ id: w.id, title: w.title, html: this.sanitizer.bypassSecurityTrustHtml(w.html) }))),
      error: () => this.widgets.set([]),
    });
  }

  /** A link to this site inside a widget navigates within the app, not by a full page load. Other links, and modified clicks, are left to the browser. */
  protected follow(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest?.('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || !href.startsWith('/') || href.startsWith('//') || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    void this.router.navigateByUrl(href);
  }
}
