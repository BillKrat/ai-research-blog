// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageBannerService } from '@adventures/core';
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
            items: [
              { id: 'exceptions', label: 'Exceptions', route: '/admin/exceptions', icon: 'warning', available: true, badge: 3 },
              { id: 'maintenance', label: 'Maintenance', route: '/admin/maintenance', icon: 'build', available: true, badge: null },
            ],
          },
        ],
      });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const headings = Array.from(root.querySelectorAll('.admin-shell__heading')).map((h) => h.textContent ?? '');
    expect(headings.length).toBe(2);
    expect(headings[0]).toContain('Content');
    expect(headings[1]).toContain('System');
    (root.querySelectorAll('.admin-shell__heading button')[1] as HTMLButtonElement).click(); // the menu is an accordion: open System
    fixture.detectChanges();
    const link = root.querySelector('a.admin-shell__item') as HTMLAnchorElement; // the first entry of the open section
    expect(link.textContent).toContain('Exceptions');
    expect(link.getAttribute('href')).toBe('/admin/exceptions');
    expect(link.querySelector('.admin-shell__badge')?.textContent?.trim()).toBe('3');
    (root.querySelectorAll('.admin-shell__heading button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
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

      const link = root.querySelector('a.admin-shell__item') as HTMLAnchorElement; // the first entry of the open section
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

describe('AdminShell banner', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('shows the banner a page set, with its action, above the menu and the content, and removes it when cleared', () => {
    const fixture = TestBed.createComponent(AdminShell);
    const banner = TestBed.inject(PageBannerService);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.admin-shell__banner')).toBeNull();

    let acted = false;
    banner.show({ text: 'Showing the 4 occurrences of X', actionLabel: 'Show all', action: () => (acted = true) });
    fixture.detectChanges();

    const el = root.querySelector('.admin-shell__banner') as HTMLElement;
    expect(el.textContent).toContain('Showing the 4 occurrences of X');
    expect(el.compareDocumentPosition(root.querySelector('.admin-shell__nav') as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    (el.querySelector('button') as HTMLButtonElement).click();
    expect(acted).toBe(true);

    banner.clear();
    fixture.detectChanges();
    expect(root.querySelector('.admin-shell__banner')).toBeNull();
  });
});

describe('AdminShell as the legacy menu (DCP: user usage review)', () => {
  const sections = [
    { id: 'Dashboard', label: 'Dashboard', items: [{ id: 'dashboard', label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard', available: true, badge: null }] },
    {
      id: 'Content',
      label: 'Content',
      items: [
        { id: 'posts', label: 'Posts', route: '/admin/posts', icon: 'article', available: true, badge: null },
        { id: 'pages', label: 'Pages', route: '/admin/pages', icon: 'description', available: true, badge: null },
      ],
    },
    { id: 'Collaboration', label: 'Collaboration', items: [{ id: 'collaboration', label: 'Collaboration', route: '/admin/collaboration', icon: 'forum', available: true, badge: 2 }, { id: 'decisions', label: 'Decisions', route: '/admin/decisions', icon: 'gavel', available: true, badge: null }] },
  ];

  beforeEach(async () => {
    sessionStorage.setItem('auth.username', 'BillKrat');
    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections });
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  const headingButton = (root: HTMLElement, name: string) =>
    Array.from(root.querySelectorAll('.admin-shell__heading button')).find((b) => b.textContent?.includes(name)) as HTMLButtonElement;

  it('opens one section at a time, like the legacy menu: opening one closes the other', () => {
    const { fixture, root } = render();

    headingButton(root, 'Content').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Posts');
    expect(headingButton(root, 'Content').getAttribute('aria-expanded')).toBe('true');

    headingButton(root, 'Collaboration').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Decisions');
    expect(root.textContent).not.toContain('Posts');
    expect(headingButton(root, 'Content').getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the open section closes it', () => {
    const { fixture, root } = render();
    headingButton(root, 'Content').click();
    fixture.detectChanges();

    headingButton(root, 'Content').click();
    fixture.detectChanges();

    expect(root.textContent).not.toContain('Posts');
  });

  it('draws a section with a single entry as a direct link, with no accordion button', () => {
    const { root } = render();

    const direct = Array.from(root.querySelectorAll('a.admin-shell__heading-link')).map((a) => a.getAttribute('href'));
    expect(direct).toEqual(['/admin/dashboard']);
    expect(root.querySelector('.admin-shell__heading button[aria-expanded]')).not.toBeNull(); // the others are still accordions
  });

  it('shows the badge of a closed section on its heading so a waiting item is never hidden', () => {
    const { root } = render();

    expect(headingButton(root, 'Collaboration').querySelector('.admin-shell__badge')?.textContent?.trim()).toBe('2');
  });

  it('has a panel above the menu with Log off, Change password, Profile and View my blog', () => {
    const { root } = render();

    const panel = root.querySelector('.admin-shell__panel') as HTMLElement;
    expect(panel.textContent).toContain('BillKrat');
    const labels = Array.from(panel.querySelectorAll('a, button')).map((e) => e.getAttribute('aria-label'));
    expect(labels).toEqual(['Log off', 'Change password', 'Profile', 'View my blog']);
    expect((panel.querySelector('a[aria-label="Profile"]') as HTMLAnchorElement).getAttribute('href')).toBe('/profile');
    expect((panel.querySelector('a[aria-label="Change password"]') as HTMLAnchorElement).getAttribute('href')).toBe('/profile#password');
    expect((panel.querySelector('a[aria-label="View my blog"]') as HTMLAnchorElement).getAttribute('href')).toBe('/');
  });

  it('shows a notice on every admin screen while the address mirrors another site', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections: [] });
    http.expectOne((r) => r.url.endsWith('/api/tenant/current')).flush({
      host: 'scratch.example',
      tenant: { id: 't1', name: 'DEV Main', domain: 'global-webnet.com' },
      match: 'Mirror',
      own: { id: 't9', domain: 'scratch.example' },
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const notice = root.querySelector('.admin-shell__mirror') as HTMLElement;
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain('global-webnet.com');
    expect(notice.textContent).toContain('scratch.example');
    expect(notice.textContent).toContain('change');
  });

  it('shows no mirror notice for an ordinary address', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/admin/menu')).flush({ sections: [] });
    http.expectOne((r) => r.url.endsWith('/api/tenant/current')).flush({ host: 'a.example', tenant: { id: 't1', name: 'Main', domain: 'a.example' }, match: 'Domain' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.admin-shell__mirror')).toBeNull();
  });
});
