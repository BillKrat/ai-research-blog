import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EntityGridModel } from '../../models/entity-form.model';
import { EntityGrid, GridRequest } from './entity-grid';

function model(overrides: Partial<EntityGridModel> = {}): EntityGridModel {
  return {
    schema: {
      schemaIri: 'urn:users',
      fields: [
        { name: 'Id', type: 'Guid', isRequired: false, label: 'Id', order: 0, isListVisible: false },
        { name: 'UserName', type: 'String', isRequired: true, label: 'User name', order: 1 },
        { name: 'Email', type: 'String', isRequired: false, label: 'Email', order: 2 },
      ],
    },
    rows: [
      { entityId: 'u1', values: { Id: 'u1', UserName: 'Admin', Email: 'a@x.test' } },
      { entityId: 'u2', values: { Id: 'u2', UserName: 'Claude', Email: 'c@x.test' } },
    ],
    paging: { page: 2, pageSize: 2, totalCount: 5, totalPages: 3, sort: 'UserName', descending: false },
    links: { self: '/api/users?page=2', next: '/api/users?page=3', previous: '/api/users?page=1' },
    ...overrides,
  };
}

function render(grid: EntityGridModel): ComponentFixture<EntityGrid> {
  const fixture = TestBed.createComponent(EntityGrid);
  const component = fixture.componentInstance;
  component.model = grid;
  component.ngOnChanges({ model: new SimpleChange(undefined, grid, true) });
  fixture.detectChanges();
  return fixture;
}

describe('EntityGrid', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EntityGrid], providers: [provideRouter([])] }).compileComponents();
  });

  it('shows the server-flagged default columns with their labels, and not the hidden ones', () => {
    const root = render(model()).nativeElement as HTMLElement;

    const headers = Array.from(root.querySelectorAll('thead th')).map((th) => th.textContent?.replace(/[▲▼]/g, '').trim());
    expect(headers).toEqual(['User name', 'Email']);
  });

  it('lets the gear show a column the server hid by default', () => {
    const fixture = render(model());
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.entity-grid__gear') as HTMLButtonElement).click();
    fixture.detectChanges();
    const idBox = Array.from(root.querySelectorAll('.entity-grid__columns input')).at(0) as HTMLInputElement;
    expect(idBox.checked).toBe(false);
    idBox.click();
    fixture.detectChanges();

    const headers = Array.from(root.querySelectorAll('thead th')).map((th) => th.textContent?.replace(/[▲▼]/g, '').trim());
    expect(headers).toEqual(['Id', 'User name', 'Email']);
  });

  it('marks the sorted column and asks for the opposite order when it is clicked', () => {
    const fixture = render(model());
    const root = fixture.nativeElement as HTMLElement;
    const requests: GridRequest[] = [];
    fixture.componentInstance.request.subscribe((r) => requests.push(r));

    expect(root.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('User name');
    (root.querySelectorAll('thead th button')[0] as HTMLButtonElement).click();
    (root.querySelectorAll('thead th button')[1] as HTMLButtonElement).click();

    expect(requests).toEqual([
      { kind: 'sort', field: 'UserName', descending: true },
      { kind: 'sort', field: 'Email', descending: false },
    ]);
  });

  it('draws the pager from the server paging and links, and asks for next and previous', () => {
    const fixture = render(model());
    const root = fixture.nativeElement as HTMLElement;
    const requests: GridRequest[] = [];
    fixture.componentInstance.request.subscribe((r) => requests.push(r));

    expect(root.querySelector('.entity-grid__pager')?.textContent).toContain('Page 2 of 3 (5 in all)');
    const [previous, next] = Array.from(root.querySelectorAll('.entity-grid__pager button')) as HTMLButtonElement[];
    previous.click();
    next.click();

    expect(requests).toEqual([{ kind: 'previous' }, { kind: 'next' }]);
  });

  it('disables a pager button the server gave no link for, and has no pager or sorting without paging', () => {
    const first = render(model({ links: { self: '/api/users', next: '/api/users?page=2', previous: null } }));
    const [previous] = Array.from((first.nativeElement as HTMLElement).querySelectorAll('.entity-grid__pager button')) as HTMLButtonElement[];
    expect(previous.disabled).toBe(true);

    const plain = render(model({ paging: null, links: null })).nativeElement as HTMLElement;
    expect(plain.querySelector('.entity-grid__pager')).toBeNull();
    expect(plain.querySelector('thead th button')).toBeNull();
  });

  it('shows the server display text for a pointer field instead of its raw id', () => {
    const grid = model({
      rows: [{ entityId: 'a1', values: { Id: 'a1', UserName: 'role-guid-1', Email: '' }, display: { UserName: 'Administrators' } }],
      paging: null,
      links: null,
    });
    const root = render(grid).nativeElement as HTMLElement;

    expect(root.querySelector('tbody td')?.textContent).toBe('Administrators');
  });

  it('turns a listed boolean into a switch only when the host asks for it, and emits the flip with the row link', () => {
    const grid = model({
      schema: {
        schemaIri: 'urn:pages',
        fields: [
          { name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 },
          { name: 'IsPublished', type: 'bool', isRequired: false, label: 'Published', order: 2 },
        ],
      },
      rows: [{ entityId: 'p1', values: { Title: 'Disclaimer', IsPublished: 'false' } }],
      paging: null,
      links: { self: '/api/pages', rows: { p1: '/api/pages/p1' } },
    });

    const plain = render(grid);
    expect((plain.nativeElement as HTMLElement).querySelector('mat-slide-toggle')).toBeNull();

    const fixture = TestBed.createComponent(EntityGrid);
    fixture.componentInstance.model = grid;
    fixture.componentInstance.toggleFields = ['IsPublished'];
    fixture.componentInstance.ngOnChanges({ model: new SimpleChange(undefined, grid, true) });
    fixture.detectChanges();
    const requests: GridRequest[] = [];
    fixture.componentInstance.request.subscribe((r) => requests.push(r));

    const input = (fixture.nativeElement as HTMLElement).querySelector('mat-slide-toggle button') as HTMLButtonElement;
    expect(input.getAttribute('aria-checked')).toBe('false');
    input.click();

    expect(requests).toEqual([{ kind: 'toggle', entityId: 'p1', link: '/api/pages/p1', field: 'IsPublished', value: true }]);
  });

  it('locks the switch of a row that has a value in the lock field (a revision), with no flip emitted', () => {
    const grid = model({
      schema: {
        schemaIri: 'urn:posts',
        fields: [
          { name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 },
          { name: 'IsPublished', type: 'bool', isRequired: false, label: 'Published', order: 2 },
          { name: 'RevisionOf', type: 'ref:urn:posts', isRequired: false, label: 'Revision of', order: 3, isListVisible: false },
        ],
      },
      rows: [
        { entityId: 'p1', values: { Title: 'Help', IsPublished: 'true', RevisionOf: '' } },
        { entityId: 'r1', values: { Title: 'Help', IsPublished: 'false', RevisionOf: 'p1' } },
      ],
      paging: null,
      links: { self: '/api/posts', rows: { p1: '/api/posts/p1', r1: '/api/posts/r1' } },
    });
    const fixture = TestBed.createComponent(EntityGrid);
    fixture.componentInstance.model = grid;
    fixture.componentInstance.toggleFields = ['IsPublished'];
    fixture.componentInstance.toggleLockedField = 'RevisionOf';
    fixture.componentInstance.ngOnChanges({ model: new SimpleChange(undefined, grid, true) });
    fixture.detectChanges();
    const requests: GridRequest[] = [];
    fixture.componentInstance.request.subscribe((r) => requests.push(r));

    const switches = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('mat-slide-toggle button')) as HTMLButtonElement[];
    expect(switches.map((s) => s.disabled)).toEqual([false, true]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.entity-grid__row--revision').length).toBe(1);
    switches[1].click();
    expect(requests).toEqual([]);
  });

  it('offers a View icon (the public page, in the same tab) only for a row with a slug when the host names a public route', () => {
    const grid = model({
      schema: {
        schemaIri: 'urn:posts',
        fields: [
          { name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 },
          { name: 'Slug', type: 'String', isRequired: false, label: 'Slug', order: 2, isListVisible: false },
        ],
      },
      rows: [
        { entityId: 'p1', values: { Title: 'Has slug', Slug: 'has-slug' } },
        { entityId: 'p2', values: { Title: 'No slug', Slug: '' } },
      ],
      paging: null,
      links: { self: '/api/posts', rows: { p1: '/api/posts/p1', p2: '/api/posts/p2' } },
    });
    const withBase = TestBed.createComponent(EntityGrid);
    withBase.componentInstance.model = grid;
    withBase.componentInstance.viewBase = '/post';
    withBase.componentInstance.ngOnChanges({ model: new SimpleChange(undefined, grid, true) });
    withBase.detectChanges();
    const root = withBase.nativeElement as HTMLElement;
    const rows = Array.from(root.querySelectorAll('tbody tr.entity-grid__row')) as HTMLElement[];

    rows[0].click();
    withBase.detectChanges();
    const link = root.querySelector('a.entity-grid__view') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/post/has-slug');
    expect(link.getAttribute('target')).toBeNull();   // same tab: a new tab would start without the sign-in, and a draft shows only to a signed-in administrator
    expect(root.querySelector('.entity-grid__open')).not.toBeNull();   // the editor is still one click away

    rows[1].click();
    withBase.detectChanges();
    expect(root.querySelector('a.entity-grid__view')).toBeNull();

    const noBase = render(grid).nativeElement as HTMLElement;
    (noBase.querySelector('tbody tr.entity-grid__row') as HTMLElement).click();
    expect(noBase.querySelector('a.entity-grid__view')).toBeNull();
  });

  it('offers Open on a row only when the server gave a row link, and emits that link', () => {
    const withLinks = model({ links: { self: '/api/users', rows: { u1: '/api/users/u1' } } });
    const fixture = render(withLinks);
    const root = fixture.nativeElement as HTMLElement;
    const requests: GridRequest[] = [];
    fixture.componentInstance.request.subscribe((r) => requests.push(r));

    (root.querySelectorAll('tbody tr.entity-grid__row')[0] as HTMLElement).click();
    fixture.detectChanges();
    (root.querySelector('.entity-grid__open') as HTMLButtonElement).click();
    expect(requests).toEqual([{ kind: 'open', entityId: 'u1', link: '/api/users/u1' }]);

    (root.querySelectorAll('tbody tr.entity-grid__row')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.entity-grid__open').length).toBe(0); // one panel is open at a time, and u2 has no link

    const noLinks = render(model({ links: { self: '/api/users' } })).nativeElement as HTMLElement;
    (noLinks.querySelector('tbody tr.entity-grid__row') as HTMLElement).click();
    expect(noLinks.querySelector('.entity-grid__open')).toBeNull();
  });
});
