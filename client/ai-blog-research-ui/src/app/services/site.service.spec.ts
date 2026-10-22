import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SiteService } from './site.service';

describe('SiteService', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { service: TestBed.inject(SiteService), http: TestBed.inject(HttpTestingController) };
  }

  it('starts with the defaults, reads the settings once and then serves them from memory', () => {
    const { service, http } = setup();
    expect(service.settings().title).toBe('AI Research Blog');

    service.get().subscribe();
    service.get().subscribe();
    http.expectOne((r) => r.url.endsWith('/api/public/site')).flush({ title: 'Adventures', tagline: 'Edge', postsPerPage: 5 });

    expect(service.settings()).toEqual({ title: 'Adventures', tagline: 'Edge', postsPerPage: 5 });
    http.expectNone((r) => r.url.endsWith('/api/public/site'));
  });

  it('keeps the defaults when the server fails, and reads again after refresh', () => {
    const { service, http } = setup();
    service.get().subscribe();
    http.expectOne((r) => r.url.endsWith('/api/public/site')).flush('down', { status: 503, statusText: 'Unavailable' });
    expect(service.settings().postsPerPage).toBe(10);

    service.refresh();
    http.expectOne((r) => r.url.endsWith('/api/public/site')).flush({ title: 'Back', tagline: '', postsPerPage: 20 });

    expect(service.settings().title).toBe('Back');
  });
});
