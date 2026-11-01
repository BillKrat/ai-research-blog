// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminPlugins } from './admin-plugins';

describe('AdminPlugins', () => {
  const plugin = { key: 'decisions', title: 'Decisions', description: 'd', version: '1.0', priority: 2, enabled: true };

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AdminPlugins);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/plugins') && r.method === 'GET').flush([plugin]);
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
