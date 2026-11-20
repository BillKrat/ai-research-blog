import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpinnerService } from '@adventures/core';
import { AdminExceptions } from './admin-exceptions';

describe('AdminExceptions kinds of failure', () => {
  const grid = (rows: { id: string; type: string; message: string; signature: string }[]) => ({
    schema: {
      schemaIri: 'urn:exception',
      fields: [
        { name: 'ExceptionType', type: 'String', isRequired: false, label: 'Type', order: 1 },
        { name: 'Message', type: 'String', isRequired: false, label: 'Message', order: 2 },
        { name: 'SignatureId', type: 'String', isRequired: false, label: 'Signature', order: 3 },
      ],
    },
    rows: rows.map((r) => ({ entityId: r.id, values: { ExceptionType: r.type, Message: r.message, SignatureId: r.signature } })),
  });

  const kinds = [
    { id: 'k1', exceptionType: 'ClientReportedException', messagePattern: 'boom {n}', topFrame: 'app', firstSeen: null, lastSeen: '2026-11-19', occurrenceCount: 155, status: 'New' },
    { id: 'k2', exceptionType: 'TimeoutException', messagePattern: 'slow', topFrame: 'db', firstSeen: null, lastSeen: '2026-11-18', occurrenceCount: 1, status: 'New' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminExceptions],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function open() {
    const fixture = TestBed.createComponent(AdminExceptions);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/admin/exceptions') && !r.params.has('signature')).flush(grid([
      { id: 'e1', type: 'ClientReportedException', message: 'boom 1', signature: 'k1' },
      { id: 'e2', type: 'TimeoutException', message: 'slow', signature: 'k2' },
    ]));
    http.expectOne((r) => r.url.endsWith('/api/admin/exceptions/signatures')).flush(kinds);
    for (const pending of http.match((r) => r.url.endsWith('/api/admin/exceptions/count'))) {
      pending.flush({ count: 2, total: 2 });
    }

    fixture.detectChanges();
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  }

  it('shows each kind with a button that carries how many times it was seen', () => {
    const { root } = open();

    const buttons = Array.from(root.querySelectorAll('button.admin-exceptions__drill')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['155', '1']);
    expect(buttons[0].getAttribute('aria-label')).toContain('155 occurrences of ClientReportedException');
  });

  it('drills into a kind: asks the server for just its occurrences and says which kind is shown', () => {
    const { fixture, http, root } = open();

    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/api/admin/exceptions') && r.params.get('signature') === 'k1').flush(grid([
      { id: 'e1', type: 'ClientReportedException', message: 'boom 1', signature: 'k1' },
      { id: 'e3', type: 'ClientReportedException', message: 'boom 3', signature: 'k1' },
    ]));
    fixture.detectChanges();

    const banner = root.querySelector('.admin-exceptions__filter') as HTMLElement;
    expect(banner.textContent).toContain('ClientReportedException');
    expect(banner.textContent).toContain('2');
    expect(root.textContent).toContain('boom 3');
    expect(root.textContent).not.toContain('TimeoutException slow');
  });

  it('Show all brings every occurrence back', () => {
    const { fixture, http, root } = open();
    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    http.expectOne((r) => r.params.get('signature') === 'k1').flush(grid([]));
    fixture.detectChanges();

    (root.querySelector('.admin-exceptions__filter button') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/api/admin/exceptions') && !r.params.has('signature')).flush(grid([
      { id: 'e1', type: 'ClientReportedException', message: 'boom 1', signature: 'k1' },
    ]));
    fixture.detectChanges();

    expect(root.querySelector('.admin-exceptions__filter')).toBeNull();
  });

  it('keeps the drill-down when the purged history is switched on or off', () => {
    const { fixture, http, root } = open();
    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    http.expectOne((r) => r.params.get('signature') === 'k1').flush(grid([]));
    fixture.detectChanges();

    const toggle = root.querySelector('.admin-exceptions__toggle input') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));

    const again = http.expectOne((r) => r.url.endsWith('/api/admin/exceptions') && r.params.get('signature') === 'k1');
    expect(again.request.params.get('includePurged')).toBe('true');
    again.flush(grid([]));
    http.match((r) => r.url.endsWith('/api/admin/exceptions/signatures')).forEach((p) => p.flush(kinds));
  });

  it('a pill clicked while "show history" is off switches it on, so purged occurrences are listed too', () => {
    const { fixture, http, root } = open();
    const toggle = root.querySelector('.admin-exceptions__toggle input') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    const request = http.expectOne((r) => r.url.endsWith('/api/admin/exceptions') && r.params.get('signature') === 'k1');
    expect(request.request.params.get('includePurged')).toBe('true');
    request.flush(grid([]));
    fixture.detectChanges();

    expect(toggle.checked).toBe(true);
  });

  it('turns the gears on when a pill is clicked and off when the list has arrived', () => {
    const { fixture, http, root } = open();
    const spinner = TestBed.inject(SpinnerService);
    expect(spinner.active()).toBe(false);

    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    expect(spinner.active()).toBe(true);
    http.expectOne((r) => r.params.get('signature') === 'k1').flush(grid([]));
    fixture.detectChanges();
    expect(spinner.active()).toBe(false);
  });

  it('pages the list: Next asks the server for page 2 and keeps the drill-down and history', () => {
    const { fixture, http, root } = open();
    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    const paged = (page: number) => ({
      ...grid([{ id: `e${page}`, type: 'ClientReportedException', message: `boom p${page}`, signature: 'k1' }]),
      paging: { page, pageSize: 25, totalCount: 60, totalPages: 3, sort: null, descending: false },
      links: { self: '', next: page < 3 ? 'n' : null, previous: page > 1 ? 'p' : null },
    });
    http.expectOne((r) => r.params.get('signature') === 'k1').flush(paged(1));
    fixture.detectChanges();
    expect(root.textContent).toContain('Page 1 of 3');

    (Array.from(root.querySelectorAll('.entity-grid__pager button')).find((b) => b.textContent === 'Next') as HTMLButtonElement).click();
    const next = http.expectOne((r) => r.url.endsWith('/api/admin/exceptions') && r.params.get('page') === '2');
    expect(next.request.params.get('signature')).toBe('k1');
    expect(next.request.params.get('includePurged')).toBe('true');
    next.flush(paged(2));
    fixture.detectChanges();
    expect(root.textContent).toContain('Page 2 of 3');

    (Array.from(root.querySelectorAll('.entity-grid__pager button')).find((b) => b.textContent === 'Previous') as HTMLButtonElement).click();
    expect(http.expectOne((r) => r.params.get('page') === '1')).toBeTruthy();
  });

  it('a new pill starts again at page 1', () => {
    const { http, root } = open();
    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    expect(http.expectOne((r) => r.params.get('signature') === 'k1').request.params.get('page')).toBe('1');
  });

  it('turns the gears off when the list fails to load', () => {
    const { http, root } = open();
    const spinner = TestBed.inject(SpinnerService);

    (root.querySelector('button.admin-exceptions__drill') as HTMLButtonElement).click();
    http.expectOne((r) => r.params.get('signature') === 'k1').flush('no', { status: 500, statusText: 'Server Error' });
    expect(spinner.active()).toBe(false);
  });
});
