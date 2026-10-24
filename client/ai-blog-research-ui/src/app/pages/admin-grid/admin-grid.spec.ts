import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminGrid } from './admin-grid';

describe('AdminGrid filter', () => {
  const grid = (rows: { entityId: string; values: Record<string, string> }[], filterValue: string | null = null) => ({
    schema: { schemaIri: 'https://x/Item', fields: [{ name: 'Title', type: 'String', isRequired: false }, { name: 'Kind', type: 'String', isRequired: false }] },
    rows,
    paging: { page: 1, pageSize: 25, totalCount: rows.length, totalPages: 1, sort: null, descending: false, filter: filterValue ? 'Kind' : null, filterValue },
    filters: [{ field: 'Kind', label: 'Kind', choices: ['Developer', 'Research'] }],
    links: { self: '/api/collaboration', rows: {} },
  });

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { collection: '/api/collaboration', title: 'Collaboration' } } } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });
    const fixture = TestBed.createComponent(AdminGrid);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return { fixture, http };
  }

  it('offers the server filters, and asks the server for the chosen value', () => {
    const { fixture, http } = setup();
    http.expectOne((r) => r.url.endsWith('/api/collaboration') && !r.params.has('filter')).flush(grid([{ entityId: '1', values: { Title: 'A', Kind: 'Developer' } }]));
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('select[aria-label="Filter by Kind"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    select.value = 'Research';
    select.dispatchEvent(new Event('change'));

    const request = http.expectOne((r) => r.params.get('filter') === 'Kind' && r.params.get('filterValue') === 'Research');
    request.flush(grid([], 'Research'));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Nothing matches this filter.');
    expect((fixture.nativeElement as HTMLElement).querySelector('select[aria-label="Filter by Kind"]')).not.toBeNull();
  });
});
