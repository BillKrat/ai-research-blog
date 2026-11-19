import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminComments } from './admin-comments';

describe('AdminComments', () => {
  const rows = [
    { id: 'c1', postSlug: 'a-post', postTitle: 'A post', author: 'Pat', email: 'pat@example.com', created: '2026-11-19T10:00:00Z', status: 'Pending', body: 'Nice <b>one</b>' },
    { id: 'c2', postSlug: 'a-post', postTitle: 'A post', author: 'Sam', email: null, created: '2026-11-18T10:00:00Z', status: 'Approved', body: 'Also good' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComments],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function render(filterAnswer = rows) {
    const fixture = TestBed.createComponent(AdminComments);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/comments')).flush(filterAnswer);
    fixture.detectChanges();
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  }

  it('lists the comments with their post and status, showing the text as plain text', () => {
    const { root } = render();

    const text = root.textContent ?? '';
    expect(text).toContain('Pat');
    expect(text).toContain('A post');
    expect(text).toContain('Pending');
    expect(text).toContain('Nice <b>one</b>');
    expect(root.querySelector('b')).toBeNull();
  });

  it('asks the server for one status when the filter changes', () => {
    const { fixture, http, root } = render();
    const select = root.querySelector('select[aria-label="Show"]') as HTMLSelectElement;

    select.value = 'Pending';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/comments') && r.params.get('status') === 'Pending').flush([rows[0]]);
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('approves the ticked comments and reloads the list', () => {
    const { fixture, http, root } = render();
    (root.querySelector('input[aria-label="Select Pat"]') as HTMLInputElement).click();
    fixture.detectChanges();

    (root.querySelector('button.comments-admin__approve') as HTMLButtonElement).click();

    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/comments/process'));
    expect(post.request.body).toEqual({ action: 'approve', ids: ['c1'] });
    post.flush({ changed: 1 });
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/comments')).flush([{ ...rows[0], status: 'Approved' }, rows[1]]);
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Pending');
  });

  it('deletes only after the person confirms', () => {
    const { fixture, http, root } = render();
    (root.querySelector('input[aria-label="Select Sam"]') as HTMLInputElement).click();
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    (root.querySelector('button.comments-admin__delete') as HTMLButtonElement).click();
    http.expectNone((r) => r.method === 'POST');

    (root.querySelector('button.comments-admin__delete') as HTMLButtonElement).click();
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/comments/process'));
    expect(post.request.body).toEqual({ action: 'delete', ids: ['c2'] });
    expect(confirm).toHaveBeenCalledTimes(2);
    post.flush({ changed: 1 });
    http.expectOne((r) => r.method === 'GET').flush([rows[0]]);
  });

  it('keeps the buttons off until something is ticked', () => {
    const { root } = render();

    expect((root.querySelector('button.comments-admin__approve') as HTMLButtonElement).disabled).toBe(true);
    expect((root.querySelector('button.comments-admin__delete') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says so when there are no comments, and when the list cannot be loaded', () => {
    expect(render([]).root.textContent).toContain('No comments');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AdminComments], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AdminComments);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/api/comments')).flush('no', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent).toContain('could not be loaded');
  });
});
