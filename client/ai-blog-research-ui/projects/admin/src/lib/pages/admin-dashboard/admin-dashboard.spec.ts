import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
