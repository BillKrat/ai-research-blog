import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MarkdownContent } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';

/**
 * About: the repository README as the page (the build copies it to <c>about.md</c>), with links to the help articles on the project's own site. The links open in
 * a new tab: they are public pages, and the admin area stays where it was.
 */
@Component({
  selector: 'adv-admin-about',
  imports: [PageHeader, MarkdownContent, MatIconModule],
  templateUrl: './admin-about.html',
  styleUrl: './admin-about.scss',
})
export class AdminAbout {
  private readonly http = inject(HttpClient);

  protected readonly readme = signal<string | null>(null);
  protected readonly failed = signal(false);

  /** Where the project's help lives: its Help and Development log categories and every post. */
  protected readonly help = [
    { label: 'Help articles', href: 'https://www.global-webnet.com/category/Help' },
    { label: 'Development log', href: 'https://www.global-webnet.com/category/Development%20log' },
    { label: 'All posts', href: 'https://www.global-webnet.com/posts' },
  ];

  constructor() {
    this.http.get('about.md', { responseType: 'text' }).subscribe({
      next: (text) => this.readme.set(text),
      error: () => this.failed.set(true),
    });
  }
}
