import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpinnerService } from '@adventures/core';
import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  const answer = {
    publishedPosts: 12,
    draftPosts: 3,
    publishedPages: 5,
    draftPages: 1,
    exceptions: 2,
    collaborationWaiting: 0,
    commentsPending: 4,
    draftPostList: [{ id: 'p1', title: 'Half written' }],
    draftPageList: [],
    latestComments: [{ id: 'c1', author: 'Anna', postTitle: 'A post', status: 'Pending', created: '2026-11-22T10:00:00+00:00', excerpt: 'Nice post, thank you' }],
  };

  it('shows the counts, what waits for a person and the drafts, linking each draft to its editor', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/api/admin/dashboard')).flush(answer);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const text = root.textContent ?? '';
    expect(text).toContain('Published posts');
    expect(text.replace(/\s+/g, ' ')).toContain('Comments to approve4');
    const draft = Array.from(root.querySelectorAll('a')).find((a) => a.textContent?.includes('Half written')) as HTMLAnchorElement;
    expect(draft.getAttribute('href')).toBe('/admin/posts/p1');
    expect(root.querySelector('.dashboard__empty')?.textContent).toContain('None');
  });

  it('says so when the dashboard cannot be loaded', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/api/admin/dashboard'))
      .flush('no', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.dashboard__problem')?.textContent).toContain('could not be loaded');
  });

  it('starts the gears, loads the dashboard first, checks health last, and stops the gears when health has answered', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    const spinner = TestBed.inject(SpinnerService);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    // while the dashboard loads: gears on, no health pill yet, no health call yet
    expect(spinner.active()).toBe(true);
    expect(root.querySelector('adv-health-pill')).toBeNull();
    expect(http.match((r) => r.url.endsWith('/api/health/detail')).length).toBe(0);

    http.expectOne((r) => r.url.endsWith('/api/admin/dashboard')).flush(answer);
    fixture.detectChanges();

    // the health check is the last thing started; the gears stay on until it answers
    expect(root.querySelector('adv-health-pill')).not.toBeNull();
    expect(spinner.active()).toBe(true);
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush({ status: 'Healthy', timestampUtc: new Date().toISOString() });
    fixture.detectChanges();
    expect(spinner.active()).toBe(false);
  });

  it('still checks health and stops the gears when the dashboard cannot be loaded', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    const spinner = TestBed.inject(SpinnerService);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/api/admin/dashboard')).flush('no', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush('no', { status: 500, statusText: 'Server Error' });
    expect(spinner.active()).toBe(false);
  });

  it('leaves the gears off when the page is left before it finishes', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    const spinner = TestBed.inject(SpinnerService);
    fixture.detectChanges();
    fixture.destroy();
    expect(spinner.active()).toBe(false);
  });

  function open() {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/admin/dashboard')).flush(answer);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const el = root.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      el.value = value;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const save = () => {
      (root.querySelector('[data-action="quick-save"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, http, root, type, save };
  }

  it('lists the latest comments with who wrote them, on which post, their state and an excerpt', () => {
    const { root } = open();
    const comment = root.querySelector('.dashboard__comment') as HTMLElement;

    expect(comment.textContent).toContain('Anna');
    expect(comment.textContent).toContain('A post');
    expect(comment.textContent).toContain('Pending');
    expect(comment.textContent).toContain('Nice post, thank you');
    expect(root.querySelector('a[href="/admin/comments"]')).not.toBeNull();
  });

  it('saves a quick draft and links to it, then reads the dashboard again so the counts follow', () => {
    const { fixture, http, root, type, save } = open();
    type('input[name="quickTitle"]', 'An idea');
    type('textarea[name="quickContent"]', 'Some text');

    save();
    const post = http.expectOne((r) => r.url.endsWith('/api/admin/dashboard/quick-draft') && r.method === 'POST');
    expect(post.request.body).toEqual({ title: 'An idea', content: 'Some text' });
    post.flush({ id: 'new1', title: 'An idea' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(root.querySelector('a[href="/admin/posts/new1"]')).not.toBeNull();
    expect((root.querySelector('input[name="quickTitle"]') as HTMLInputElement).value).toBe('');
    http.expectOne((r) => r.url.endsWith('/api/admin/dashboard') && r.method === 'GET').flush(answer);
  });

  it('asks for a title before sending anything', () => {
    const { http, root, type, save } = open();
    type('textarea[name="quickContent"]', 'Some text');

    save();

    http.expectNone((r) => r.url.endsWith('/quick-draft'));
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('title');
  });

  it('shows the reason when the draft cannot be saved', () => {
    const { fixture, http, root, type, save } = open();
    type('input[name="quickTitle"]', 'An idea');

    save();
    http.expectOne((r) => r.url.endsWith('/quick-draft')).flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('permission');
  });
});
