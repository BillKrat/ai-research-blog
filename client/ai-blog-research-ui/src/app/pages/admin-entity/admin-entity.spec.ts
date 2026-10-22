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
  function setup(): { params: BehaviorSubject<ReturnType<typeof convertToParamMap>>; http: HttpTestingController; component: AdminEntity; fixture: ReturnType<typeof TestBed.createComponent<AdminEntity>> } {
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
    return { params, http: TestBed.inject(HttpTestingController), component: fixture.componentInstance, fixture };
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

  it('offers a Publish eye on an entity whose published flag is a plain field (a page), which flips the flag and saves', () => {
    const { params, http, fixture } = setup();
    http.expectOne((r) => r.url.endsWith('/api/pages/new')).flush(blank);
    params.next(convertToParamMap({ id: 'p1' }));
    const page = {
      contractVersion: 1,
      schema: {
        schemaIri: 'urn:page',
        fields: [
          { name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 },
          { name: 'IsPublished', type: 'bool', isRequired: false, label: 'Published', order: 2 },
        ],
      },
      entity: { entityId: 'p1', values: { Title: 'Disclaimer', IsPublished: 'false' } },
    };
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/pages/p1')).flush(page);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const eye = root.querySelector('button[aria-label="Publish"]') as HTMLButtonElement;

    expect(eye).not.toBeNull();
    eye.click();

    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/pages/p1'));
    expect(put.request.body.values.IsPublished).toBe('true');
    expect(put.request.body.values.Title).toBe('Disclaimer');
  });

  it('has no Publish eye on a post, which has a server publish action of its own', () => {
    const { params, http, fixture } = setup();
    http.expectOne((r) => r.url.endsWith('/api/pages/new')).flush(blank);
    params.next(convertToParamMap({ id: 'p2' }));
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/pages/p2')).flush({
      contractVersion: 1,
      schema: { schemaIri: 'urn:post', fields: [{ name: 'IsPublished', type: 'bool', isRequired: false, label: 'Published', order: 1, isReadOnly: true }] },
      entity: { entityId: 'p2', values: { IsPublished: 'false' } },
      actions: [{ name: 'publish', label: 'Publish', link: '/api/posts/p2/publish' }],
    });
    fixture.detectChanges();
    const eyes = (fixture.nativeElement as HTMLElement).querySelectorAll('button[aria-label="Publish"]');

    expect(eyes.length).toBe(1);   // the server action only, not a second button
  });

  it('goes back to the list when an action such as Apply revision removes the entry (the refresh answers 404)', () => {
    const { http, component } = setup();
    http.expectOne((r) => r.url.endsWith('/api/pages/new')).flush(blank);
    const navigate = TestBed.inject(Router).navigate as ReturnType<typeof vi.fn>;
    (component as unknown as { reload(): void }).reload();
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/pages/new')).flush('gone', { status: 404, statusText: 'Not Found' });

    expect(navigate).toHaveBeenCalledWith(['/admin', 'pages']);
  });
});
