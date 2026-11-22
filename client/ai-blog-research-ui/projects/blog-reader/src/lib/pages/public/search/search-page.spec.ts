import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SearchPage } from './search-page';

describe('SearchPage', () => {
  const result = {
    query: 'angular',
    total: 12,
    page: 1,
    pageSize: 10,
    hits: [
      { kind: 'post', slug: 'angular-signals', title: 'Angular signals', snippet: '…about <b>signals</b> and forms…', datePublished: '2026-05-25T10:00:00+00:00' },
      { kind: 'page', slug: 'angular-guide', title: 'Angular guide', snippet: 'A guide.', datePublished: null },
    ],
  };

  function setup(params: Record<string, string> = {}) {
    const query = new BehaviorSubject(convertToParamMap(params));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap: query } }],
    });
    const fixture = TestBed.createComponent(SearchPage);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    return { fixture, http, router, query, page: fixture.nativeElement as HTMLElement };
  }

  it('asks for nothing until there is a query, and says what to do', () => {
    const { http, page } = setup();

    http.expectNone((r) => r.url.endsWith('/api/public/search'));
    expect(page.textContent).toContain('Type what you are looking for');
  });

  it('searches the query in the address and lists the hits with links to the post or the page', () => {
    const { fixture, http, page } = setup({ q: 'angular' });

    const request = http.expectOne((r) => r.url.endsWith('/api/public/search'));
    expect(request.request.params.get('q')).toBe('angular');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(result);
    fixture.detectChanges();

    const links = Array.from(page.querySelectorAll('a.search__title')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(links).toEqual([['Angular signals', '/post/angular-signals'], ['Angular guide', '/page/angular-guide']]);
    expect(page.textContent).toContain('12 results');
  });

  it('shows the snippet as plain text, never as markup', () => {
    const { fixture, http, page } = setup({ q: 'angular' });
    http.expectOne((r) => r.url.endsWith('/api/public/search')).flush(result);
    fixture.detectChanges();

    expect(page.querySelector('.search__snippet b')).toBeNull();
    expect(page.querySelector('.search__snippet')?.textContent).toContain('<b>signals</b>');
  });

  it('says so when nothing matches', () => {
    const { fixture, http, page } = setup({ q: 'zzzz' });
    http.expectOne((r) => r.url.endsWith('/api/public/search')).flush({ ...result, query: 'zzzz', total: 0, hits: [] });
    fixture.detectChanges();

    expect(page.textContent).toContain('Nothing was found');
  });

  it('shows the refusal when the query is too short, or the limit when searching too fast', () => {
    const { fixture, http, page } = setup({ q: 'a' });
    http.expectOne((r) => r.url.endsWith('/api/public/search')).flush('Type at least two letters to search.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('two letters');
  });

  it('puts a new query in the address (so it can be linked and the back button works)', () => {
    const { fixture, router, page } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const box = page.querySelector('input[name="q"]') as HTMLInputElement;
    box.value = '  mcp servers ';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (page.querySelector('[data-action="search"]') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith([], { queryParams: { q: 'mcp servers', page: 1 } });
  });

  it('pages through the results', () => {
    const { fixture, http, router, page } = setup({ q: 'angular' });
    http.expectOne((r) => r.url.endsWith('/api/public/search')).flush(result);
    fixture.detectChanges();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (page.querySelector('[data-action="next"]') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith([], { queryParams: { q: 'angular', page: 2 } });
    expect((page.querySelector('[data-action="previous"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
