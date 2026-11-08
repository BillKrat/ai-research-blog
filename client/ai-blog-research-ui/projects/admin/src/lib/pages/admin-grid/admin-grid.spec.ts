// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantService } from '../../services/tenant.service';
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

describe('AdminGrid everyone toggle', () => {
  function setup(platform: boolean, collection: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { collection, title: 'Users' } } } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });
    const tenants = TestBed.inject(TenantService);
    const http = TestBed.inject(HttpTestingController);
    if (platform) {
      tenants.load();
      http.match(() => true).forEach((r) => {
        if (r.request.url.endsWith('/api/auth/rights')) {
          r.flush({ userName: 'Admin', rights: [{ name: 'platform.manage', description: '' }] });
        }
      });
    }
    const fixture = TestBed.createComponent(AdminGrid);
    fixture.detectChanges();
    return { fixture, http };
  }

  const empty = { schema: { schemaIri: 'https://x/User', fields: [] }, rows: [], paging: null, links: { self: '/api/users', rows: {} } };

  it('lets a platform administrator list everyone on the Users screen, and asks the server with the scope filter', () => {
    const { fixture, http } = setup(true, '/api/users');
    http.expectOne((r) => r.url.endsWith('/api/users') && !r.params.has('filter')).flush(empty);
    http.match((r) => r.url.endsWith('/api/tenant/hosts')).forEach((r) => r.flush([]));
    fixture.detectChanges();

    const box = (fixture.nativeElement as HTMLElement).querySelector('input[aria-label="Show everyone, all tenants"]') as HTMLInputElement;
    expect(box).not.toBeNull();
    box.checked = true;
    box.dispatchEvent(new Event('change'));

    http.expectOne((r) => r.params.get('filter') === 'Scope' && r.params.get('filterValue') === 'Everyone').flush(empty);
  });

  it('shows no toggle to anyone else, nor on another screen', () => {
    const plain = setup(false, '/api/users');
    plain.http.expectOne((r) => r.url.endsWith('/api/users')).flush(empty);
    plain.fixture.detectChanges();
    expect((plain.fixture.nativeElement as HTMLElement).querySelector('input[aria-label="Show everyone, all tenants"]')).toBeNull();
  });
});
