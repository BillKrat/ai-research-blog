// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EntityApiService } from './entity-api.service';

const emptyGrid = { schema: { schemaIri: 'x', fields: [] }, rows: [] };
const emptyForm = { schema: { schemaIri: 'x', fields: [] }, entity: { entityId: 'u1', values: {} } };

describe('EntityApiService', () => {
  let service: EntityApiService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EntityApiService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('starts at the collection path it is given and sends the sort as query parameters', () => {
    service.grid('/api/roles', { sort: 'Name', descending: true, pageSize: 10 }).subscribe();

    const request = controller.expectOne((r) => r.url.endsWith('/api/roles'));
    expect(request.request.params.get('sort')).toBe('Name');
    expect(request.request.params.get('descending')).toBe('true');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush(emptyGrid);
  });

  it('follows a server-supplied grid link exactly as given', () => {
    service.followGrid('/api/users?page=3&pageSize=25&sort=UserName&descending=false').subscribe();

    const request = controller.expectOne((r) => r.urlWithParams.endsWith('/api/users?page=3&pageSize=25&sort=UserName&descending=false'));
    expect(request.request.method).toBe('GET');
    request.flush(emptyGrid);
  });

  it('reads a form by link and saves it with a PUT to the same link', () => {
    service.form('/api/users/u1').subscribe();
    controller.expectOne((r) => r.url.endsWith('/api/users/u1')).flush(emptyForm);

    service.update('/api/users/u1', 'u1', { First: 'Bill' }).subscribe();
    const put = controller.expectOne((r) => r.url.endsWith('/api/users/u1') && r.method === 'PUT');
    expect(put.request.body).toEqual({ entityId: 'u1', values: { First: 'Bill' } });
    put.flush(emptyForm);
  });
});
