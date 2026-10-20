import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminExceptionsService } from './admin-exceptions.service';

describe('AdminExceptionsService', () => {
  let service: AdminExceptionsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminExceptionsService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('knows the user is an administrator and keeps the total (history) count', () => {
    service.refresh();
    controller.expectOne((r) => r.url.endsWith('/api/admin/exceptions/count')).flush({ count: 0, total: 3 });

    expect(service.isAdministrator()).toBe(true);
    expect(service.activeCount()).toBe(0);
    expect(service.totalCount()).toBe(3);
  });

  it('is not an administrator after a refusal', () => {
    service.refresh();
    controller
      .expectOne((r) => r.url.endsWith('/api/admin/exceptions/count'))
      .flush('no', { status: 403, statusText: 'Forbidden' });

    expect(service.isAdministrator()).toBe(false);
    expect(service.totalCount()).toBe(0);
  });

  it('asks for the purged entries only when told to', () => {
    service.grid().subscribe();
    expect(controller.expectOne((r) => r.url.endsWith('/api/admin/exceptions')).request.params.has('includePurged')).toBe(false);

    service.grid(true).subscribe();
    expect(controller.expectOne((r) => r.url.endsWith('/api/admin/exceptions')).request.params.get('includePurged')).toBe('true');
  });

it('sets the status of a kind of failure with a PUT', () => {    service.setSignatureStatus('sig 1', 'Fixed').subscribe();    const request = controller.expectOne((r) => r.url.endsWith('/api/admin/exceptions/signatures/sig%201/status'));    expect(request.request.method).toBe('PUT');    expect(request.request.body).toEqual({ status: 'Fixed' });    request.flush(null);  });
  it('asks the server to triage one request by its correlation id', () => {
    service.triage('abc-123').subscribe((result) => expect(result.verdict).toBe('Recovered'));

    const request = controller.expectOne((r) => r.url.endsWith('/api/admin/diagnostics/abc-123/triage'));
    expect(request.request.method).toBe('GET');
    request.flush({ correlationId: 'abc-123', verdict: 'Recovered', summary: '', findings: [], nextSteps: [], handOffCommand: '' });
  });

  it('asks Claude with a POST, never a GET (it costs money)', () => {
    service.askClaude('abc-123').subscribe((result) => expect(result.available).toBe(true));

    const request = controller.expectOne((r) => r.url.endsWith('/api/admin/diagnostics/abc-123/ai-triage'));
    expect(request.request.method).toBe('POST');
    request.flush({ available: true, reason: null, model: 'm', summary: 's', likelyCause: 'c', confidence: 'high', nextSteps: [], missingEvidence: [], inputTokens: 1, outputTokens: 1, sentCharacters: 1, fromCache: false });
  });
});
