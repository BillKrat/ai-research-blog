import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    await TestBed.configureTestingModule({ imports: [EntityGrid] }).compileComponents();
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
});
