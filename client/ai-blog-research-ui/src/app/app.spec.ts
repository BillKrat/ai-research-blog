// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

describe('App layout width', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }])],
    }).compileComponents();
  });

  it('keeps the reading width on the public site and uses the whole window in the admin area, so the menu sits at the left edge', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    const page = () => (fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement;

    await router.navigateByUrl('/posts');
    fixture.detectChanges();
    expect(page().classList.contains('page--wide')).toBe(false);

    await router.navigateByUrl('/admin/roles');
    fixture.detectChanges();
    expect(page().classList.contains('page--wide')).toBe(true);

    await router.navigateByUrl('/login');
    fixture.detectChanges();
    expect(page().classList.contains('page--wide')).toBe(false);
  });
});

describe('App start-up', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('does not run the health check (it probes the database and the MCP server): it only asks the cheap runtime question', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);

    http.expectNone((r) => r.url.includes('/api/health'));
    expect(http.match((r) => r.url.endsWith('/api/runtime')).length).toBe(1);
  });

  it('shows no health pill in the header (it is on the Dashboard)', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('API:');
  });
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('AI Research Blog');
  });

  it('shows a LIVE DATA banner only when the API says it is a local run on the live store', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).match((r) => r.url.endsWith('/api/runtime'))[0].flush({ liveData: true });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.page__live')?.textContent).toContain('LIVE DATA');
  });

  it('shows no banner for an ordinary run', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).match((r) => r.url.endsWith('/api/runtime'))[0].flush({ liveData: false });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.page__live')).toBeNull();
  });
});

describe('App RSS link', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('offers the feed in the header, pointing at the public feed endpoint of the API', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a[aria-label="RSS feed"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toMatch(/\/api\/public\/feed$/);
  });
});

describe('App layout switch', () => {
  // A screen that is slow to open (a guard that does not answer yet): the layout must already be the new area's, so the new screen never
  // shows for a moment in the old area's layout (full width with no zones, or the narrow public column) and then jumps.
  const pending = () => new Promise<boolean>(() => undefined);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/slow', canActivate: [pending], children: [] },
          { path: 'slow-public', canActivate: [pending], children: [] },
          { path: '**', children: [] },
        ]),
      ],
    }).compileComponents();
  });

  it('switches to the admin layout as soon as the route is recognised, before the admin screen has opened', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/posts');
    fixture.detectChanges();

    void router.navigateByUrl('/admin/slow');
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();

    expect(((fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement).classList.contains('page--wide')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('adv-widget-zone')).toBeNull();
  });

  it('switches to the public layout, with its zones, as soon as the route is recognised, before the public screen has opened', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/admin/roles');
    fixture.detectChanges();
    expect(((fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement).classList.contains('page--wide')).toBe(true);

    void router.navigateByUrl('/slow-public');
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();

    expect(((fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement).classList.contains('page--wide')).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('adv-widget-zone').length).toBe(4);
  });

  it('keeps the old layout when a navigation is refused (a redirect to sign-in is a new navigation that decides again)', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/posts');
    fixture.detectChanges();

    await router.navigateByUrl('/login');
    fixture.detectChanges();

    expect(((fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement).classList.contains('page--wide')).toBe(false);
  });
});

describe('App colour mode', () => {
  const setup = async (storage: Record<string, string> = {}) => {
    const store = new Map<string, string>(Object.entries(storage));
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    document.body.style.colorScheme = '';
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const answerSite = (colorMode?: string) => {
      http.expectOne((r) => r.url.endsWith('/api/public/site')).flush({ title: 'T', tagline: '', postsPerPage: 10, colorMode });
      fixture.detectChanges();
    };
    return { fixture, answerSite };
  };

  afterEach(() => vi.unstubAllGlobals());

  it('starts dark when nothing says otherwise', async () => {
    const { answerSite } = await setup();
    answerSite();
    expect(document.body.style.colorScheme).toBe('dark');
  });

  it('follows the site default for a visitor who has not used the toggle', async () => {
    const { answerSite } = await setup();
    answerSite('light');
    expect(document.body.style.colorScheme).toBe('light');
  });

  it('keeps the visitor own choice over the site default', async () => {
    const { answerSite } = await setup({ 'adv.colorMode': 'dark' });
    answerSite('light');
    expect(document.body.style.colorScheme).toBe('dark');
  });

  it('remembers the toggle in the browser, and from then on the site default no longer changes it', async () => {
    const { fixture, answerSite } = await setup();
    answerSite('light');
    ((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Switch to dark mode"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(document.body.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('adv.colorMode')).toBe('dark');
  });

  it('paints the last known site default at start-up so a light site does not flash dark', async () => {
    await setup({ 'adv.siteColorMode': 'light' });
    expect(document.body.style.colorScheme).toBe('light');
  });
});

describe('App language', () => {
  it('reads the texts of the site language at start-up and puts them in the label table', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);

    http.expectOne((r) => r.url.endsWith('/api/public/labels')).flush({ language: 'de', labels: { signIn: 'Anmelden' } });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Anmelden"]')).not.toBeNull();
  });
});
