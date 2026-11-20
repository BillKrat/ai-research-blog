import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SiteService } from '../../services/site.service';
import { PostComments } from './post-comments';

describe('PostComments', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostComments],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function render(approved: object[] = []) {
    const fixture = TestBed.createComponent(PostComments);
    fixture.componentRef.setInput('slug', 'a-post');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/public/posts/a-post/comments')).flush(approved);
    fixture.detectChanges();
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  }

  function fill(root: HTMLElement, name: string, text: string): void {
    const set = (selector: string, value: string): void => {
      const field = root.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    };
    set('[name=author]', name);
    set('[name=body]', text);
  }

  it('lists the approved comments as plain text, never as markup', () => {
    const { root } = render([{ author: 'Pat', created: '2026-11-19T10:00:00Z', body: '<b>hi</b> there' }]);

    const item = root.querySelector('.comments__item') as HTMLElement;
    expect(item.textContent).toContain('Pat');
    expect(item.querySelector('b')).toBeNull();
    expect(item.textContent).toContain('<b>hi</b> there');
  });

  it('says there are no comments yet when none is approved', () => {
    expect(render().root.textContent).toContain('No comments yet');
  });

  it('sends the comment and says it will appear after approval, clearing the form', () => {
    const { fixture, http, root } = render();
    fill(root, 'Pat', 'Nice post');
    fixture.detectChanges();

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/public/posts/a-post/comments'));
    expect(post.request.body).toEqual({ author: 'Pat', email: '', body: 'Nice post', website: '' });
    post.flush({ message: 'Thank you. Your comment will appear after it has been approved.' }, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();

    expect(root.querySelector('.comments__notice')?.textContent).toContain('after it has been approved');
    expect((root.querySelector('[name=body]') as HTMLTextAreaElement).value).toBe('');
  });

  it('does not send an empty comment', () => {
    const { fixture, http, root } = render();
    fill(root, '', '   ');
    fixture.detectChanges();

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

    fixture.detectChanges();
    http.expectNone((r) => r.method === 'POST');
    expect(root.querySelector('.comments__problem')?.textContent).toContain('name and a comment');
  });

  it('shows the reason the server gave, and a plain message when it is too busy', () => {
    const { fixture, http, root } = render();
    fill(root, 'Pat', 'Nice');
    fixture.detectChanges();
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne((r) => r.method === 'POST').flush('Comments are not open on this post.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root.querySelector('.comments__problem')?.textContent).toContain('Comments are not open on this post.');

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne((r) => r.method === 'POST').flush('slow down', { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(root.querySelector('.comments__problem')?.textContent).toContain('wait a minute');
  });

  it('carries a hidden honeypot field that people never see or tab to', () => {
    const field = render().root.querySelector('[name=website]') as HTMLInputElement;

    expect(field.tabIndex).toBe(-1);
    expect(field.closest('[aria-hidden=true]')).not.toBeNull();
  });

  describe('when the site has turned comments off', () => {
    const closeSite = () => TestBed.inject(SiteService).settings.update((current) => ({ ...current, commentsEnabled: false }));

    it('hides the form and says comments are closed, but still shows the comments that exist', () => {
      closeSite();
      const { root } = render([{ author: 'Pat', created: '2026-11-19T10:00:00Z', body: 'Earlier remark' }]);

      expect(root.querySelector('form')).toBeNull();
      expect(root.textContent).toContain('Earlier remark');
      expect(root.textContent).toContain('Comments are closed');
    });

    it('shows nothing at all when there are no comments to keep', () => {
      closeSite();
      const { root } = render([]);

      expect(root.querySelector('.comments')).toBeNull();
    });
  });

  it('still shows the form when the site answer carries no comments flag (an older API)', () => {
    const { root } = render([]);

    expect(root.querySelector('form')).not.toBeNull();
  });
});
