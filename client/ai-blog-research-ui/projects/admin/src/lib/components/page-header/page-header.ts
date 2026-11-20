import { Component, input } from '@angular/core';

/**
 * The standard top of every admin page: the page's H2 at the left and the page's action buttons (anything projected into it)
 * right-justified on the same line, so the content starts at the top of the content area. Pages put their actions here, never
 * on a line of their own.
 */
@Component({
  selector: 'adv-page-header',
  template: `
    <header class="page-header">
      <h2 class="page-header__title">{{ title() }}</h2>
      <div class="page-header__actions" role="group" aria-label="Page actions"><ng-content /></div>
    </header>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
}
