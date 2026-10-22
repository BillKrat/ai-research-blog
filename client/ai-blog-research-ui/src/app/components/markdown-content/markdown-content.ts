import { Component, Input, computed, effect, signal } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

/** A fenced block whose language is mermaid (backticks or tildes). */
const MERMAID_FENCE = /^\s{0,3}(```|~~~)\s*mermaid\b/im;

/**
 * Renders Markdown for a reader with ngx-markdown (marked underneath). The output is sanitised by Angular's HTML sanitiser, so
 * authored content cannot run scripts, event handlers or unsafe URLs in a visitor's browser. Fenced <c>mermaid</c> blocks become
 * diagrams: the Mermaid library (large) is loaded only when the text contains such a block, then drawn with its strict security
 * level in the theme that is active when the post is shown. A diagram that does not parse shows Mermaid's own error drawing.
 */
@Component({
  selector: 'app-markdown-content',
  imports: [MarkdownComponent],
  template: `@if (ready()) {
    <markdown class="markdown" [data]="source()" [mermaid]="hasDiagram()" [mermaidOptions]="options()" />
  }`,
  styleUrl: './markdown-content.scss',
})
export class MarkdownContent {
  protected readonly source = signal('');
  protected readonly hasDiagram = computed(() => MERMAID_FENCE.test(this.source()));
  private readonly mermaidLoaded = signal(false);
  protected readonly ready = computed(() => !this.hasDiagram() || this.mermaidLoaded());

  @Input({ required: true })
  set markdown(value: string | null | undefined) {
    this.source.set(value ?? '');
  }

  constructor() {
    effect(() => {
      if (this.hasDiagram() && !this.mermaidLoaded()) {
        void this.loadMermaid();
      }
    });
  }

  /** Options read when the diagrams are drawn: the dark theme when the app is in its dark mode. */
  protected options() {
    const light = typeof document !== 'undefined' && document.body.style.colorScheme === 'light';
    return { theme: light ? 'default' : 'dark', securityLevel: 'strict', startOnLoad: false } as const;
  }

  private async loadMermaid(): Promise<void> {
    // ngx-markdown looks for a global mermaid at draw time; the import is lazy so only posts with a diagram pay for it.
    const loaded = await import('mermaid');
    (globalThis as { mermaid?: unknown }).mermaid = loaded.default;
    this.mermaidLoaded.set(true);
  }
}
