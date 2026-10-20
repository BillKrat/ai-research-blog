import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminUsersService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('starts at the collection and sends the sort as query parameters', () => {
    service.first({ sort: 'UserName', descending: true, pageSize: 10 }).subscribe();

    const request = controller.expectOne((r) => r.url.endsWith('/api/users'));
    expect(request.request.params.get('sort')).toBe('UserName');
    expect(request.request.params.get('descending')).toBe('true');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ schema: { schemaIri: 'x', fields: [] }, rows: [] });
  });

  it('follows a server-supplied link exactly as given', () => {
    service.follow('/api/users?page=3&pageSize=25&sort=UserName&descending=false').subscribe();

    const request = controller.expectOne((r) => r.urlWithParams.endsWith('/api/users?page=3&pageSize=25&sort=UserName&descending=false'));
    expect(request.request.method).toBe('GET');
    request.flush({ schema: { schemaIri: 'x', fields: [] }, rows: [] });
  });
});
