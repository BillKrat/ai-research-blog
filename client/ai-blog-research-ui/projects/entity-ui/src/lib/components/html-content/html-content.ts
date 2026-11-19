import { Component, computed, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

/**
 * Shows HTML that the SERVER has already made safe (Adventures.Blog HtmlContent: scripts, event handlers, frames, forms, unsafe links and
 * resource-loading CSS removed when it was saved and again when it was served). It is the one place in the client that trusts HTML, because
 * Angular's own sanitiser would also remove the alignment and colour a visual editor writes. Never bind anything here that did not come
 * from the public content API.
 */
@Component({
  selector: 'adv-html-content',
  template: `<div class="html-content" [innerHTML]="trusted()"></div>`,
  styleUrl: './html-content.scss',
})
export class HtmlContent {
  private readonly sanitizer = inject(DomSanitizer);

  /** HTML from the public content API (already cleaned by the server). */
  readonly html = input<string | null | undefined>('');

  protected readonly trusted = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.html() ?? ''));
}
