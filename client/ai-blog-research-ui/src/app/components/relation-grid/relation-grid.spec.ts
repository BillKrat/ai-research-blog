// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntityRelationModel } from '../../models/entity-form.model';
import { RelationGrid } from './relation-grid';

function relation(overrides: { editable?: boolean } = {}): EntityRelationModel {
  const editable = overrides.editable ?? true;
  return {
    name: 'TenantRoles',
    label: 'Tenant roles',
    grid: {
      schema: {
        schemaIri: 'urn:assignment',
        fields: [
          { name: 'Id', type: 'Guid', isRequired: false, isListVisible: false, order: 0 },
          { name: 'Tenant', type: 'ref:urn:tenant', isRequired: true, label: 'Tenant', order: 1, refSchema: 'urn:tenant' },
          { name: 'Role', type: 'ref:urn:role', isRequired: true, label: 'Role', order: 2, refSchema: 'urn:role' },
        ],
      },
      rows: [{ entityId: 'a1', values: { Id: 'a1', Tenant: 't1', Role: 'r1' }, display: { Tenant: 'DEV Main', Role: 'Admin' } }],
      canCreate: editable,
      rowPermissions: { canUpdate: false, canDelete: editable },
      links: {
        self: '/api/users/u1/relations/TenantRoles',
        create: editable ? '/api/users/u1/relations/TenantRoles' : null,
        rows: { a1: '/api/users/u1/relations/TenantRoles/a1' },
        lookups: { Tenant: '/api/lookups?schema=urn%3Atenant', Role: '/api/lookups?schema=urn%3Arole' },
      },
    },
  };
}

describe('RelationGrid', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RelationGrid],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  function render(model: EntityRelationModel): ComponentFixture<RelationGrid> {
    const fixture = TestBed.createComponent(RelationGrid);
    fixture.componentInstance.relation = model;
    fixture.componentInstance.ngOnChanges({ relation: new SimpleChange(undefined, model, true) });
    fixture.detectChanges();
    return fixture;
  }

  function answerLookups(): void {
    http.expectOne((r) => r.url.includes('schema=urn%3Atenant')).flush([{ id: 't1', text: 'DEV Main' }, { id: 't2', text: 'Other' }]);
    http.expectOne((r) => r.url.includes('schema=urn%3Arole')).flush([{ id: 'r1', text: 'Admin' }, { id: 'r2', text: 'Editor' }]);
  }

  it('loads the server-supplied lookups and offers a select per pointer field, Add disabled until both are chosen', () => {
    const fixture = render(relation());
    answerLookups();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const selects = Array.from(root.querySelectorAll('select')) as HTMLSelectElement[];
    expect(selects.map((s) => s.getAttribute('aria-label'))).toEqual(['Tenant', 'Role']);
    expect(Array.from(selects[1].options).map((o) => o.textContent?.trim())).toEqual(['Choose...', 'Admin', 'Editor']);
    const add = root.querySelector('.relation-grid__add button') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  it('posts the chosen ids to the create link and tells the host to reload', () => {
    const fixture = render(relation());
    answerLookups();
    fixture.detectChanges();
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    const root = fixture.nativeElement as HTMLElement;
    const selects = Array.from(root.querySelectorAll('select')) as HTMLSelectElement[];

    selects[0].value = 't2';
    selects[0].dispatchEvent(new Event('change'));
    selects[1].value = 'r2';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (root.querySelector('.relation-grid__add button') as HTMLButtonElement).click();

    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/users/u1/relations/TenantRoles'));
    expect(post.request.body).toEqual({ entityId: '', values: { Tenant: 't2', Role: 'r2' } });
    post.flush({ entityId: 'a2', values: {} });
    expect(changed).toBe(1);
  });

  it('shows the server refusal (for example the last administrator) and does not reload', () => {
    const fixture = render(relation());
    answerLookups();
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (fixture.componentInstance as unknown as { remove(id: string): void }).remove('a1');
    http
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/users/u1/relations/TenantRoles/a1'))
      .flush('A tenant must keep at least one administrator.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(changed).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('at least one administrator');
  });

  it('is read-only when the server gave no create link or delete permission: no selects, no Remove, no lookups requested', () => {
    const fixture = render(relation({ editable: false }));
    http.expectNone((r) => r.url.includes('/api/lookups'));
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('select')).toBeNull();
    expect(root.querySelector('.relation-grid__add')).toBeNull();
    expect(root.querySelector('.entity-grid__row')).not.toBeNull();
  });

  function choose(fixture: ComponentFixture<RelationGrid>, index: number, value: string): void {
    const selects = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('select')) as HTMLSelectElement[];
    selects[index].value = value;
    selects[index].dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('labels the add button with the word Add, so nobody has to guess what the plus does', () => {
    const fixture = render(relation());
    answerLookups();
    fixture.detectChanges();

    const add = (fixture.nativeElement as HTMLElement).querySelector('.relation-grid__add button') as HTMLButtonElement;
    expect(add.textContent).toContain('Add');
  });

  it('says what to do once a choice is made but not added, and tells the host a row is pending until it is added or cleared', () => {
    const fixture = render(relation());
    answerLookups();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const pending: boolean[] = [];
    fixture.componentInstance.pendingChange.subscribe((value: boolean) => pending.push(value));
    expect(root.querySelector('.relation-grid__pending')).toBeNull();

    choose(fixture, 1, 'r2');
    expect(root.querySelector('.relation-grid__pending')?.textContent).toContain('press Add');
    expect(pending).toEqual([true]);

    choose(fixture, 1, '');
    expect(root.querySelector('.relation-grid__pending')).toBeNull();
    expect(pending).toEqual([true, false]);
  });

  it('is no longer pending once the row has been added', () => {
    const fixture = render(relation());
    answerLookups();
    fixture.detectChanges();
    const pending: boolean[] = [];
    fixture.componentInstance.pendingChange.subscribe((value: boolean) => pending.push(value));
    choose(fixture, 0, 't2');
    choose(fixture, 1, 'r2');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.relation-grid__add button')!.click();
    http.expectOne((r) => r.method === 'POST').flush({ entityId: 'a2', values: {} });

    expect(pending.at(-1)).toBe(false);
  });
});
