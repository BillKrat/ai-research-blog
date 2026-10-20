import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { MarkdownContent } from '../../components/markdown-content/markdown-content';
import { SiteNav } from '../../components/site-nav/site-nav';
import { PageView } from './page-view';
import { PostList } from './post-list';
import { PostView } from './post-view';

function routeStub(params: Record<string, string>, data: Record<string, unknown> = {}) {
  const subject = new BehaviorSubject(convertToParamMap(params));
  return { provide: ActivatedRoute, useValue: { snapshot: { data }, paramMap: subject.asObservable() } };
}

describe('Public site', () => {
  function configure(route: ReturnType<typeof routeStub>): HttpTestingController {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), route] });
    return TestBed.inject(HttpTestingController);
  }

  it('MarkdownContent renders Markdown and strips scripts and event handlers', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(MarkdownContent);
    fixture.componentRef.setInput('markdown', '# Title\n\n**bold** <script>alert(1)</script> <img src=x onerror="alert(2)">');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toBe('Title');
    expect(root.querySelector('strong')?.textContent).toBe('bold');
    expect(root.innerHTML).not.toContain('<script');
    expect(root.innerHTML).not.toContain('onerror');
  });

  it('PostList shows the published posts with links, and asks the server for the category the route names', () => {
    const http = configure(routeStub({ name: 'Help' }, { kind: 'category' }));
    const fixture = TestBed.createComponent(PostList);
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url.endsWith('/api/public/posts'));
    expect(request.request.params.get('category')).toBe('Help');
    request.flush({
      posts: [{ title: 'How it works', slug: 'how-it-works', description: 'Summary', datePublished: '2026-10-20T10:00:00Z', author: 'Claude', categories: ['Help'], tags: ['MCP'] }],
      page: 1,
      pageSize: 10,
      total: 1,
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h2')?.textContent).toBe('Category: Help');
    expect(root.querySelector('article h3 a')?.getAttribute('href')).toBe('/post/how-it-works');
    expect(root.textContent).toContain('by Claude');
    expect(root.querySelector('.public__pager')).toBeNull();
  });

  it('PostView renders the Markdown body, and says not found for a draft or unknown slug', () => {
    const http = configure(routeStub({ slug: 'how-it-works' }));
    const fixture = TestBed.createComponent(PostView);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/public/posts/how-it-works')).flush({
      summary: { title: 'How it works', slug: 'how-it-works', description: null, datePublished: null, author: 'Claude', categories: ['Help'], tags: [] },
      content: '## Steps\n\nDo this.',
      enableComments: true,
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('h2:nth-of-type(1)')?.textContent).toBe('How it works');
    expect((fixture.nativeElement as HTMLElement).querySelector('.markdown h2')?.textContent).toBe('Steps');
    TestBed.resetTestingModule();

    const missing = configure(routeStub({ slug: 'a-draft' }));
    const other = TestBed.createComponent(PostView);
    other.detectChanges();
    missing.expectOne((r) => r.url.endsWith('/api/public/posts/a-draft')).flush('no', { status: 404, statusText: 'Not Found' });
    other.detectChanges();
    expect((other.nativeElement as HTMLElement).textContent).toContain('does not exist or is not published');
  });

  it('PageView at the home address shows the front page, or a welcome when the site has none', () => {
    const http = configure(routeStub({}, { front: true }));
    const fixture = TestBed.createComponent(PageView);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/public/home')).flush('none', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no home page set yet');
  });

  it('SiteNav lists Home, Posts and the published listed pages with their sub-pages', () => {
    const http = configure(routeStub({}));
    const fixture = TestBed.createComponent(SiteNav);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/public/menu')).flush([
      { title: 'Article', slug: 'article', children: [{ title: 'Angular', slug: 'angular', children: [] }] },
    ]);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

    expect(links).toEqual([
      ['Home', '/'],
      ['Posts', '/posts'],
      ['Article', '/page/article'],
      ['Angular', '/page/angular'],
    ]);
  });

  it('SiteNav reads the menu again after every navigation, so a page published a moment ago appears without a browser refresh', async () => {
    const http = configure(routeStub({}));
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(SiteNav);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/public/menu')).flush([]);

    await router.navigateByUrl('/', { skipLocationChange: true }).catch(() => undefined);
    const again = http.match((r) => r.url.endsWith('/api/public/menu'));
    expect(again.length).toBeGreaterThan(0);
    again[0].flush([{ title: 'New page', slug: 'new-page', children: [] }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('New page');
  });
});