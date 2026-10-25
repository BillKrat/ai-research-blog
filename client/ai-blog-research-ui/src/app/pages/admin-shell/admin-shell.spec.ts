// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminShell } from './admin-shell';

describe('AdminShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('renders the server menu: links for built screens, a badge, and unbuilt screens dimmed without a link', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/api/admin/menu'))
      .flush({
        sections: [
          { id: 'Content', label: 'Content', items: [{ id: 'posts', label: 'Posts', route: null, icon: 'article', available: false, badge: null }] },
          {
            id: 'System',
            label: 'System',
            items: [{ id: 'exceptions', label: 'Exceptions', route: '/admin/exceptions', icon: 'warning', available: true, badge: 3 }],
          },
        ],
      });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(Array.from(root.querySelectorAll('.admin-shell__heading')).map((h) => h.textContent?.trim())).toEqual(['Content', 'System']);
    const link = root.querySelector('a.admin-shell__item') as HTMLAnchorElement;
    expect(link.textContent).toContain('Exceptions');
    expect(link.getAttribute('href')).toBe('/admin/exceptions');
    expect(link.querySelector('.admin-shell__badge')?.textContent?.trim()).toBe('3');
    const soon = root.querySelector('.admin-shell__item--soon') as HTMLElement;
    expect(soon.textContent).toContain('Posts');
    expect(soon.tagName).toBe('SPAN');
  });

  it('says so when the server sent no menu', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('do not have access');
  });

  function renderWithTenant(answer: object): HTMLElement {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections: [] });
    http.expectOne((r) => r.url.endsWith('/api/tenant/current')).flush(answer);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the tenant the domain names, so it is always clear which one is being administered', () => {
    const root = renderWithTenant({ host: 'www.adventuresedge.net', tenant: { id: 't3', name: 'Adventures Edge', domain: 'adventuresEdge.net' }, match: 'Domain' });

    const badge = root.querySelector('.admin-shell__tenant') as HTMLElement;
    expect(badge.textContent).toContain('Adventures Edge');
    expect(badge.textContent).toContain('adventuresEdge.net');
    expect(badge.textContent).not.toContain('development');
  });

  it('says the tenant is a development stand-in when the host matched none and the fallback named it', () => {
    const root = renderWithTenant({ host: 'localhost:4200', tenant: { id: 't1', name: 'DEV Main', domain: 'global-webnet.com' }, match: 'Fallback' });

    const badge = root.querySelector('.admin-shell__tenant') as HTMLElement;
    expect(badge.textContent).toContain('DEV Main');
    expect(badge.textContent).toContain('development');
    expect(badge.textContent).toContain('localhost:4200');
  });

  it('says no tenant matches the domain, naming the domain, instead of showing nothing', () => {
    const root = renderWithTenant({ host: 'stranger.example', tenant: null, match: 'None' });

    expect((root.querySelector('.admin-shell__tenant') as HTMLElement).textContent).toContain('No tenant for stranger.example');
  });
});
