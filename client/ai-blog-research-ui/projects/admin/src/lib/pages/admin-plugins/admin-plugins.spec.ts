// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminPlugins } from './admin-plugins';

describe('AdminPlugins', () => {
  const plugin = { key: 'decisions', title: 'Decisions', description: 'd', version: '1.0', priority: 2, enabled: true };

  const emptyReport = { loaded: [], failures: [] };

  function setup(report: object = emptyReport) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AdminPlugins);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/plugins') && r.method === 'GET').flush([plugin]);
    http.expectOne((r) => r.url.endsWith('/api/plugins/load-report') && r.method === 'GET').flush(report);
    fixture.detectChanges();
    return { fixture, http };
  }

  it('lists the plug-ins with a switch each', () => {
    const { fixture } = setup();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Decisions');
    expect((fixture.nativeElement as HTMLElement).querySelector('input[role="switch"]')).not.toBeNull();
  });

  it('switches a plug-in off through the API and reads the menu again', () => {
    const { fixture, http } = setup();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input[role="switch"]') as HTMLInputElement;
    input.checked = false;
    input.dispatchEvent(new Event('change'));
    http.expectOne((r) => r.url.endsWith('/api/plugins/decisions/disable') && r.method === 'POST').flush(null);

    http.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections: [] });
  });

  it('says so when the change is refused', () => {
    const { fixture, http } = setup();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input[role="switch"]') as HTMLInputElement;
    input.checked = false;
    input.dispatchEvent(new Event('change'));
    http.expectOne((r) => r.url.endsWith('/api/plugins/decisions/disable')).flush('no', { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('AdminPlugins discovery report', () => {
  const plugin = { key: 'decisions', title: 'Decisions', description: 'd', version: '1.0', priority: 2, enabled: true };

  function setup(report: object | string) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AdminPlugins);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/plugins') && r.method === 'GET').flush([plugin]);
    const reportRequest = http.expectOne((r) => r.url.endsWith('/api/plugins/load-report'));
    if (report === 'fails') {
      reportRequest.flush('no', { status: 500, statusText: 'Server Error' });
    } else {
      reportRequest.flush(report as object);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each refused plug-in file with the reason, so a refusal is never silent', () => {
    const page = setup({ loaded: [], failures: [{ source: 'directory:Bad.dll', reason: 'Bad.dll is not on the approved list, so it was not loaded.' }] });

    const refused = page.querySelector('.admin-plugins__refused');
    expect(refused).not.toBeNull();
    expect(refused!.textContent).toContain('directory:Bad.dll');
    expect(refused!.textContent).toContain('not on the approved list');
  });

  it('shows where a discovered plug-in came from', () => {
    const page = setup({ loaded: [{ key: 'sample', title: 'Sample plug-in', version: '0.1.0', source: 'directory:Sample.dll' }], failures: [] });

    const found = page.querySelector('.admin-plugins__found');
    expect(found).not.toBeNull();
    expect(found!.textContent).toContain('Sample plug-in');
    expect(found!.textContent).toContain('directory:Sample.dll');
    expect(page.querySelector('.admin-plugins__refused')).toBeNull();
  });

  it('shows no discovery section when nothing was found or refused', () => {
    const page = setup({ loaded: [], failures: [] });

    expect(page.querySelector('.admin-plugins__found')).toBeNull();
    expect(page.querySelector('.admin-plugins__refused')).toBeNull();
  });

  it('still lists the plug-ins when the report cannot be read, and says so', () => {
    const page = setup('fails');

    expect(page.textContent).toContain('Decisions');
    expect(page.querySelector('[role="alert"]')).not.toBeNull();
  });
});
