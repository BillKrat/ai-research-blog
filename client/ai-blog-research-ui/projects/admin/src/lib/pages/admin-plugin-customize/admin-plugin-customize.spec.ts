import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AdminPluginCustomize } from './admin-plugin-customize';

describe('AdminPluginCustomize', () => {
  const model = {
    definitions: [
      { name: 'ExtraAllowedTags', label: 'Extra allowed tags', description: 'Tags to keep.', kind: 'Lines', default: '', maxLength: 1000 },
      { name: 'AllowedUrlSchemes', label: 'Allowed schemes', description: 'Schemes.', kind: 'Text', default: 'http,https,mailto', maxLength: 200 },
      { name: 'Loud', label: 'Loud', description: 'Shout.', kind: 'Bool', default: 'false', maxLength: 10 },
      { name: 'Limit', label: 'Limit', description: 'How many.', kind: 'Number', default: '5', maxLength: 10 },
    ],
    values: { ExtraAllowedTags: 'details', AllowedUrlSchemes: 'http,https,mailto', Loud: 'false', Limit: '5' },
  };

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['key', 'html-sanitizer']]) } } },
      ],
    });
    const fixture = TestBed.createComponent(AdminPluginCustomize);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/plugins/html-sanitizer/settings') && r.method === 'GET').flush(model);
    fixture.detectChanges();
    return { fixture, http, page: fixture.nativeElement as HTMLElement };
  }

  it('shows a field for each declared setting, filled with its current value, by kind', () => {
    const { page } = setup();

    expect(page.textContent).toContain('Extra allowed tags');
    expect((page.querySelector('textarea[name="ExtraAllowedTags"]') as HTMLTextAreaElement).value).toBe('details');
    expect((page.querySelector('input[name="AllowedUrlSchemes"]') as HTMLInputElement).value).toBe('http,https,mailto');
    expect((page.querySelector('input[type="checkbox"][name="Loud"]') as HTMLInputElement).checked).toBe(false);
    expect((page.querySelector('input[type="number"][name="Limit"]') as HTMLInputElement).value).toBe('5');
  });

  it('saves every value and says it was saved', () => {
    const { fixture, http, page } = setup();
    const tags = page.querySelector('textarea[name="ExtraAllowedTags"]') as HTMLTextAreaElement;
    tags.value = 'details\nsummary';
    tags.dispatchEvent(new Event('input'));
    const loud = page.querySelector('input[type="checkbox"][name="Loud"]') as HTMLInputElement;
    loud.checked = true;
    loud.dispatchEvent(new Event('change'));

    (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    const request = http.expectOne((r) => r.url.endsWith('/api/plugins/html-sanitizer/settings') && r.method === 'PUT');
    expect(request.request.body.values).toEqual({ ExtraAllowedTags: 'details\nsummary', AllowedUrlSchemes: 'http,https,mailto', Loud: 'true', Limit: '5' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(page.querySelector('.plugin-customize__saved')).not.toBeNull();
  });

  it('shows the reason when a value is refused, and does not say saved', () => {
    const { fixture, http, page } = setup();

    (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    http
      .expectOne((r) => r.method === 'PUT')
      .flush("'script' cannot be allowed here.", { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(page.querySelector('[role="alert"]')).not.toBeNull();
    expect(page.querySelector('.plugin-customize__saved')).toBeNull();
  });

  it('says so when the plug-in has no settings screen (not found)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['key', 'nope']]) } } },
      ],
    });
    const fixture = TestBed.createComponent(AdminPluginCustomize);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/plugins/nope/settings')).flush('', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });
});
