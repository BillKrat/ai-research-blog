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
