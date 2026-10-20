import { Component, Input, computed, signal } from '@angular/core';
import { marked } from 'marked';

/**
 * Renders Markdown for a reader. The Markdown becomes HTML with marked and is bound as innerHTML, which Angular sanitises (scripts,
 * event handlers and unsafe URLs are stripped), so authored content cannot run code in a visitor's browser. Diagrams (Mermaid)
 * are a backlog item; today a mermaid block shows as code.
 */
@Component({
  selector: 'app-markdown-content',
  template: '<div class="markdown" [innerHTML]="html()"></div>',
  styleUrl: './markdown-content.scss',
})
export class MarkdownContent {
  private readonly source = signal('');

  @Input({ required: true })
  set markdown(value: string | null | undefined) {
    this.source.set(value ?? '');
  }

  protected readonly html = computed(() => marked.parse(this.source(), { async: false }) as string);
}
