// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiProblemService } from '@adventures/core';
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

describe('App health badge follows an unanswered API', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('turns to "unreachable" as soon as any call to the API goes unanswered, and back when it answers again (no waiting for the next health check)', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((r) => r.url.endsWith('/api/health'))[0].flush({ status: 'Healthy', timestampUtc: new Date().toISOString() });
    fixture.detectChanges();
    // the badge itself is shown to administrators only; the state it draws from is what matters here
    const badge = () => (fixture.componentInstance as unknown as { healthState(): string }).healthState();
    expect(badge()).toBe('healthy');

    TestBed.inject(ApiProblemService).reportHttp(new HttpErrorResponse({ status: 0, statusText: 'Timeout' }));
    fixture.detectChanges();
    expect(badge()).toBe('unreachable');

    TestBed.inject(ApiProblemService).clear();
    fixture.detectChanges();
    expect(badge()).toBe('healthy');
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
    TestBed.inject(HttpTestingController).match((r) => r.url.endsWith('/api/health'))[0].flush({ status: 'Healthy', timestampUtc: new Date().toISOString(), liveData: true });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.page__live')?.textContent).toContain('LIVE DATA');
  });

  it('shows no banner for an ordinary health answer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).match((r) => r.url.endsWith('/api/health'))[0].flush({ status: 'Healthy', timestampUtc: new Date().toISOString() });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.page__live')).toBeNull();
  });
});
