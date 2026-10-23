import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

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
