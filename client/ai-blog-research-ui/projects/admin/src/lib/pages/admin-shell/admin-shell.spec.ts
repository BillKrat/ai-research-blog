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

  describe('collapsing the menu', () => {
    const store = new Map<string, string>();
    const fake: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => store.get(k) ?? null,
      key: (i) => [...store.keys()][i] ?? null,
      removeItem: (k) => void store.delete(k),
      setItem: (k, v) => void store.set(k, String(v)),
    };

    beforeEach(() => {
      store.clear();
      vi.stubGlobal('localStorage', fake);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const menu = {
      sections: [
        { id: 'Content', label: 'Content', items: [{ id: 'posts', label: 'Posts', route: '/admin/posts', icon: 'article', available: true, badge: 2 }] },
      ],
    };

    function open() {
      const fixture = TestBed.createComponent(AdminShell);
      fixture.detectChanges();
      TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/api/admin/menu')).flush(menu);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const toggle = () => root.querySelector('.admin-shell__toggle') as HTMLButtonElement;
      return { fixture, root, toggle, shell: () => root.querySelector('.admin-shell') as HTMLElement };
    }

    it('starts open, and the button collapses and expands the menu', () => {
      const { fixture, toggle, shell } = open();
      expect(shell().classList.contains('admin-shell--collapsed')).toBe(false);
      expect(toggle().getAttribute('aria-label')).toBe('Collapse menu');
      expect(toggle().getAttribute('aria-expanded')).toBe('true');

      toggle().click();
      fixture.detectChanges();

      expect(shell().classList.contains('admin-shell--collapsed')).toBe(true);
      expect(toggle().getAttribute('aria-label')).toBe('Expand menu');
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      toggle().click();
      fixture.detectChanges();
      expect(shell().classList.contains('admin-shell--collapsed')).toBe(false);
    });

    it('keeps every item reachable while collapsed: a link with its name as a tooltip and for screen readers, and the badge still showing', () => {
      const { fixture, root, toggle } = open();

      toggle().click();
      fixture.detectChanges();

      const link = root.querySelector('a.admin-shell__item') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/admin/posts');
      expect(link.getAttribute('title')).toBe('Posts');
      expect(link.getAttribute('aria-label')).toBe('Posts');
      expect(link.querySelector('.admin-shell__badge')?.textContent?.trim()).toBe('2');
    });

    it('remembers the choice for the next visit', () => {
      const first = open();
      first.toggle().click();
      first.fixture.detectChanges();
      expect(store.get('adv.admin-menu-collapsed')).toBe('true');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [AdminShell], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });

      const again = open();

      expect(again.shell().classList.contains('admin-shell--collapsed')).toBe(true);
      again.toggle().click();
      again.fixture.detectChanges();
      expect(store.get('adv.admin-menu-collapsed')).toBe('false');
    });

    it('works when the browser refuses storage', () => {
      vi.spyOn(fake, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(fake, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const { fixture, toggle, shell } = open();

      toggle().click();
      fixture.detectChanges();

      expect(shell().classList.contains('admin-shell--collapsed')).toBe(true);
    });
  });
});
