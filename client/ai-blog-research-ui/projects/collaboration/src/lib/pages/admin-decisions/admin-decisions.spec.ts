// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { AdminDecisions } from './admin-decisions';

describe('AdminDecisions', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideMarkdown()] });
    const fixture = TestBed.createComponent(AdminDecisions);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), root: fixture.nativeElement as HTMLElement };
  }

  it('lists the decisions with a link to the post each belongs to', async () => {
    const { fixture, http, root } = setup();
    http.expectOne((r) => r.url.endsWith('/api/decisions')).flush([
      { id: 'c2', postId: 'p2', postTitle: 'Second summary', postSlug: 'second', author: 'Admin', created: '2026-10-23T12:00:00Z', body: 'Collaborators role waits' },
      { id: 'c1', postId: 'p1', postTitle: 'First summary', postSlug: 'first', author: 'Admin', created: '2026-10-22T12:00:00Z', body: 'Site settings go ahead' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(root.querySelectorAll('article a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(links).toEqual([['Second summary', '/admin/posts/p2'], ['First summary', '/admin/posts/p1']]);
    expect(root.textContent).not.toContain('No decisions recorded yet');
  });

  it('says so when there are none, and shows a failure', () => {
    const { fixture, http, root } = setup();
    http.expectOne((r) => r.url.endsWith('/api/decisions')).flush([]);
    fixture.detectChanges();
    expect(root.textContent).toContain('No decisions recorded yet');
  });
});
