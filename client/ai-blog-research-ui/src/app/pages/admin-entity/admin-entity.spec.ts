import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AdminEntity } from './admin-entity';

const blank = {
  contractVersion: 1,
  schema: { schemaIri: 'urn:page', fields: [{ name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 }] },
  entity: { entityId: '', values: { Title: null } },
};
const saved = { ...blank, entity: { entityId: 'p1', values: { Title: 'Home' } } };

describe('AdminEntity', () => {
  function setup(): { params: BehaviorSubject<ReturnType<typeof convertToParamMap>>; http: HttpTestingController; component: AdminEntity } {
    const params = new BehaviorSubject(convertToParamMap({ id: 'new' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true), getCurrentNavigation: () => null } },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { collection: '/api/pages', title: 'Pages' } }, paramMap: params.asObservable() } },
      ],
    });
    const fixture = TestBed.createComponent(AdminEntity);
    fixture.detectChanges();
    return { params, http: TestBed.inject(HttpTestingController), component: fixture.componentInstance };
  }

  it('opens the blank form for "new" and creates once', () => {
    const { http, component } = setup();
    http.expectOne((r) => r.url.endsWith('/api/pages/new')).flush(blank);

    (component as unknown as { onSave(v: Record<string, string | null>): void }).onSave({ Title: 'Home' });
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/pages'));
    expect(post.request.body).toEqual({ entityId: '', values: { Title: 'Home' } });
    post.flush(saved);
  });

  it('reloads for the created entity when only the id changes, so a second Save updates it instead of creating a duplicate', () => {
    const { params, http, component } = setup();
    http.expectOne((r) => r.url.endsWith('/api/pages/new')).flush(blank);
    (component as unknown as { onSave(v: Record<string, string | null>): void }).onSave({ Title: 'Home' });
    http.expectOne((r) => r.method === 'POST').flush(saved);

    // the router moves to /admin/pages/p1: the same component instance stays alive and only the param changes
    params.next(convertToParamMap({ id: 'p1' }));
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/pages/p1')).flush(saved);

    (component as unknown as { onSave(v: Record<string, string | null>): void }).onSave({ Title: 'Home 2' });
    const put = http.expectOne((r) => r.url.endsWith('/api/pages/p1'));
    expect(put.request.method).toBe('PUT');
    put.flush(saved);
    http.expectNone((r) => r.method === 'POST');
  });
});
