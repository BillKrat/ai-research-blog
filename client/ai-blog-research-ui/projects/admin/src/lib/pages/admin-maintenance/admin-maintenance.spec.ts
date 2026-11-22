import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminMaintenance } from './admin-maintenance';

describe('AdminMaintenance', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(AdminMaintenance);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), page: fixture.nativeElement as HTMLElement };
  }
  const press = (page: HTMLElement, action: string) => (page.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click();

  afterEach(() => vi.restoreAllMocks());

  it('downloads the content export as a file', () => {
    const created: Blob[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => (created.push(b), 'blob:x'), revokeObjectURL: () => undefined }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { fixture, http, page } = setup();

    press(page, 'export');
    const request = http.expectOne((r) => r.url.endsWith('/api/export/content') && r.method === 'GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['{}'], { type: 'application/json' }));
    fixture.detectChanges();

    expect(created.length).toBe(1);
    expect(click).toHaveBeenCalled();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('backup');
  });

  it('says so when the export cannot be made', () => {
    const { fixture, http, page } = setup();

    press(page, 'export');
    http.expectOne((r) => r.url.endsWith('/api/export/content')).flush(new Blob(['x']), { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('permission');
  });

  it('clears the cache and says it was cleared', () => {
    const { fixture, http, page } = setup();

    press(page, 'clear-cache');
    http.expectOne((r) => r.url.endsWith('/api/cache/clear') && r.method === 'POST').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(page.querySelector('[role="status"]')?.textContent).toContain('cleared');
  });
});
