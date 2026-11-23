// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminMenuService } from './admin-menu.service';

describe('AdminMenuService', () => {
  let service: AdminMenuService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminMenuService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('holds the menu the server sent, and has a menu only when it contains sections', () => {
    expect(service.hasMenu()).toBe(false);

    service.load();
    controller.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({
      sections: [{ id: 'Users', label: 'Users', items: [{ id: 'users', label: 'Users', route: '/admin/users', icon: 'group', available: true, badge: null }] }],
    });

    expect(service.hasMenu()).toBe(true);
    expect(service.menu().sections[0].items[0].route).toBe('/admin/users');
  });

  it('shows no menu when the server refuses or the caller is signed out', () => {
    service.load();
    controller.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush('no', { status: 401, statusText: 'Unauthorized' });
    expect(service.hasMenu()).toBe(false);

    service.load();
    controller.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections: [{ id: 'a', label: 'a', items: [] }] });
    service.clear();
    expect(service.hasMenu()).toBe(false);
  });
});
