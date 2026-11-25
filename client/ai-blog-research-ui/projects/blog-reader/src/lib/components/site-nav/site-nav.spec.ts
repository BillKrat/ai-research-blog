import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteNav } from './site-nav';

describe('SiteNav contact link', () => {
  function render(contact: object, home: object | null) {
    TestBed.configureTestingModule({ imports: [SiteNav], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(SiteNav);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/public/menu')).flush([]);
    http.expectOne((r) => r.url.endsWith('/api/public/home')).flush(home);
    http.expectOne((r) => r.url.endsWith('/api/public/contact')).flush(contact);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelectorAll('a');
  }

  it('puts CONTACT after Home and before Posts when the plug-in is on', () => {
    const links = Array.from(render({ enabled: true, intro: '' }, { title: 'Welcome' })).map((a) => a.textContent?.trim());

    expect(links).toEqual(['Home', 'Contact', 'Posts']);
  });

  it('shows no Contact link when the plug-in is off', () => {
    const links = Array.from(render({ enabled: false, intro: '' }, { title: 'Welcome' })).map((a) => a.textContent?.trim());

    expect(links).toEqual(['Home', 'Posts']);
  });

  it('leaves Contact out when the question fails, and keeps the rest of the menu', () => {
    TestBed.configureTestingModule({ imports: [SiteNav], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(SiteNav);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/public/menu')).flush([]);
    http.expectOne((r) => r.url.endsWith('/api/public/home')).flush(null);
    http.expectOne((r) => r.url.endsWith('/api/public/contact')).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map((a) => a.textContent?.trim())).toEqual(['Posts']);
  });
});
