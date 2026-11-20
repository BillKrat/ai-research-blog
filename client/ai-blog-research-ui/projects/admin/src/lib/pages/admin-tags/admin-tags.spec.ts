import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpinnerService } from '@adventures/core';
import { AdminTags } from './admin-tags';

describe('AdminTags', () => {
  const schema = { schemaIri: 'urn:tag', fields: [{ name: 'Name', type: 'String', isRequired: true, label: 'Name', order: 1 }] };
  const row = (id: string, name: string) => ({ entityId: id, values: { Name: name } });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTags],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function open() {
    const fixture = TestBed.createComponent(AdminTags);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  }

  it('shows the tags as a cloud sized by use: each links to its posts and has an edit link to its own screen', () => {
    const { fixture, http, root } = open();
    http.expectOne((r) => r.url.endsWith('/api/tags') && r.params.get('pageSize') === '100').flush({
      schema,
      rows: [row('t1', 'Mermaid'), row('t2', 'Angular'), row('t3', 'Unused')],
      canCreate: true,
      links: { self: '/api/tags' },
    });
    http.expectOne((r) => r.url.endsWith('/api/public/tags')).flush([{ name: 'angular', posts: 9 }, { name: 'Mermaid', posts: 2 }]);
    fixture.detectChanges();

    const tags = Array.from(root.querySelectorAll('a.tag-cloud__tag')) as HTMLAnchorElement[];
    expect(tags.map((a) => a.childNodes[0].textContent)).toEqual(['Angular', 'Mermaid', 'Unused']); // alphabetical
    expect(tags[0].getAttribute('href')).toBe('/tag/Angular');
    expect(tags[0].querySelector('.tag-cloud__count')?.textContent).toBe('9'); // counts match the name whatever its case
    expect(tags[2].querySelector('.tag-cloud__count')?.textContent).toBe('0');
    expect(parseFloat(tags[0].style.fontSize)).toBeGreaterThan(parseFloat(tags[1].style.fontSize));
    expect((root.querySelector('a[aria-label="Edit Angular"]') as HTMLAnchorElement).getAttribute('href')).toBe('/admin/tags/t2');
    expect((root.querySelector('adv-page-header a[href="/admin/tags/new"]') as HTMLAnchorElement)).not.toBeNull();
  });

  it('reads every page of tags, not just the first', () => {
    const { fixture, http, root } = open();
    http.expectOne((r) => r.url.endsWith('/api/tags') && r.params.get('pageSize') === '100').flush({
      schema,
      rows: [row('t1', 'Alpha')],
      links: { self: '/api/tags', next: '/api/tags?page=2&pageSize=100' },
    });
    http.expectOne((r) => r.url.endsWith('/api/tags?page=2&pageSize=100')).flush({ schema, rows: [row('t2', 'Beta')], links: { self: '/api/tags?page=2' } });
    http.expectOne((r) => r.url.endsWith('/api/public/tags')).flush([]);
    fixture.detectChanges();

    expect(root.querySelectorAll('a.tag-cloud__tag').length).toBe(2);
  });

  it('runs the gears while loading and says so when the tags cannot be loaded', () => {
    const { fixture, http, root } = open();
    const spinner = TestBed.inject(SpinnerService);
    expect(spinner.active()).toBe(true);

    http.expectOne((r) => r.url.endsWith('/api/tags')).flush('no', { status: 500, statusText: 'Server Error' });
    http.match((r) => r.url.endsWith('/api/public/tags'));
    fixture.detectChanges();

    expect(spinner.active()).toBe(false);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
});
