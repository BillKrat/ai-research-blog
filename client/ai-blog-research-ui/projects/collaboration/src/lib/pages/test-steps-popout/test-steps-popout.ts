import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MarkdownContent } from '@adventures/entity-ui';
import { EntityApiService, describeApiError } from '@adventures/core';

/**
 * The text under a Markdown heading, up to the next heading of the same or a higher level (the heading line itself is left out); null when the
 * heading is not there. The match ignores case and surrounding blanks.
 */
export function extractSection(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const wanted = heading.trim().toLowerCase();
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim().toLowerCase() === wanted);
  if (start < 0) {
    return null;
  }

  const level = lines[start].match(/^#+/)![0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }

  return lines.slice(start + 1, end).join('\n').trim();
}

/**
 * A bare page (no admin frame) that shows only the Test steps of one collaboration item, opened in its own browser window from the item's
 * toolbar so the steps can stay on another monitor while the person works in the app. Read-only.
 */
@Component({
  selector: 'adv-test-steps-popout',
  imports: [MarkdownContent],
  template: `
    <main class="steps">
      @for (message of errors(); track message) {
        <p class="steps__error" role="alert">{{ message }}</p>
      }
      @if (loaded()) {
        <h1>{{ title() }}</h1>
        @if (steps(); as text) {
          <adv-markdown-content [markdown]="text" />
        } @else {
          <p class="steps__none">This item has no Test steps section.</p>
        }
      }
    </main>
  `,
  styles: ['.steps { max-width: 48rem; margin: 1rem auto; padding: 0 1rem; } .steps h1 { font-size: 1.25rem; } .steps__error { color: var(--mat-sys-error, #b00020); }'],
})
export class TestStepsPopout implements OnInit {
  private readonly api = inject(EntityApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly title = signal('');
  protected readonly steps = signal<string | null>(null);
  protected readonly loaded = signal(false);
  protected readonly errors = signal<string[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.form(`/api/collaboration/${encodeURIComponent(id)}`).subscribe({
      next: (form) => {
        this.title.set(form.entity.values['Title'] ?? '');
        this.steps.set(extractSection(form.entity.values['Content'] ?? '', 'Test steps'));
        this.loaded.set(true);
      },
      error: (error) => this.errors.set(describeApiError(error, 'Could not load the test steps.')),
    });
  }
}
