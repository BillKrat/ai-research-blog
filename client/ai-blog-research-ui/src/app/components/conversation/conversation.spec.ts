import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideMarkdown } from 'ngx-markdown';
import { Conversation } from './conversation';

describe('Conversation', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideMarkdown()] });
    const fixture = TestBed.createComponent(Conversation);
    fixture.componentRef.setInput('postId', 'p1');
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), root: fixture.nativeElement as HTMLElement };
  }

  it('shows the thread oldest first with decisions marked, and says so when it is empty', async () => {
    const { fixture, http, root } = setup();
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/posts/p1/comments')).flush([
      { id: 'c1', author: 'Claude', kind: 'Comment', created: '2026-10-23T10:00:00Z', body: 'Question one' },
      { id: 'c2', author: 'Admin', kind: 'Decision', created: '2026-10-23T11:00:00Z', body: 'Go ahead' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const entries = Array.from(root.querySelectorAll('article')) as HTMLElement[];
    expect(entries.map((e) => e.querySelector('strong')?.textContent)).toEqual(['Claude', 'Admin']);
    expect(entries[0].querySelector('.conversation__decision')).toBeNull();
    expect(entries[1].querySelector('.conversation__decision')?.textContent?.trim()).toBe('Decision');
    expect(root.querySelector('.conversation__none')).toBeNull();
  });

  it('adds an entry (as a decision when asked), appends what the server returns and clears the box', async () => {
    const { fixture, http, root } = setup();
    http.expectOne((r) => r.method === 'GET').flush([]);
    fixture.detectChanges();
    expect(root.querySelector('.conversation__none')).not.toBeNull();

    const component = fixture.componentInstance as unknown as { text: string; asDecision: boolean; send(): void };
    component.text = '  Approved, go ahead  ';
    component.asDecision = true;
    component.send();

    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/posts/p1/comments'));
    expect(post.request.body).toEqual({ text: 'Approved, go ahead', kind: 'Decision' });
    post.flush({ id: 'c3', author: 'Admin', kind: 'Decision', created: '2026-10-23T12:00:00Z', body: 'Approved, go ahead' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelectorAll('article').length).toBe(1);
    expect(component.text).toBe('');
    expect(component.asDecision).toBe(false);
  });

  it('does not send an empty text, and shows the server refusal', () => {
    const { fixture, http, root } = setup();
    http.expectOne((r) => r.method === 'GET').flush([]);
    const component = fixture.componentInstance as unknown as { text: string; send(): void };

    component.text = '   ';
    component.send();
    http.expectNone((r) => r.method === 'POST');

    component.text = 'hello';
    component.send();
    http.expectOne((r) => r.method === 'POST').flush({ title: 'no' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('permission');
  });
});
