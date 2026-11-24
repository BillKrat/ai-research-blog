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

  function setup(key = 'html-sanitizer') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['key', key]]) } } },
      ],
    });
    const fixture = TestBed.createComponent(AdminPluginCustomize);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith(`/api/plugins/${key}/settings`) && r.method === 'GET').flush(model);
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
  describe('a Secret setting', () => {
    const secretModel = {
      definitions: [
        { name: 'Greeting', label: 'Greeting', description: 'Plain.', kind: 'Text', default: 'hello', maxLength: 20 },
        { name: 'Token', label: 'Token', description: 'An API token.', kind: 'Secret', default: '', maxLength: 40 },
      ],
      values: { Greeting: 'hello', Token: '' },
      secretsSet: ['Token'],
    };

    function setupSecret(model = secretModel) {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['key', 'sample']]) } } },
        ],
      });
      const fixture = TestBed.createComponent(AdminPluginCustomize);
      const http = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/api/plugins/sample/settings') && r.method === 'GET').flush(model);
      fixture.detectChanges();
      return { fixture, http, page: fixture.nativeElement as HTMLElement };
    }

    it('is a password-style field that never shows the stored value, only that one is set', () => {
      const { page } = setupSecret();
      const field = page.querySelector('input[name="Token"]') as HTMLInputElement;

      expect(field.type).toBe('password');
      expect(field.autocomplete).toBe('new-password');
      expect(field.value).toBe('');
      expect(page.textContent).toContain('A value is set');
    });

    it('says nothing is set yet when the secret has no value', () => {
      const { page } = setupSecret({ ...secretModel, secretsSet: [] });

      expect(page.textContent).toContain('Not set');
      expect(page.querySelector('button.setting-field__clear')).toBeNull();
    });

    it('saves an empty secret field as empty (the server keeps the stored value) and sends a typed one', () => {
      const { page, http } = setupSecret();

      (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
      const first = http.expectOne((r) => r.method === 'PUT');
      expect(first.request.body.values.Token).toBe('');
      expect(first.request.body.clear ?? []).toEqual([]);
      first.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('sends the typed secret', () => {
      const { page, http } = setupSecret();
      const field = page.querySelector('input[name="Token"]') as HTMLInputElement;
      field.value = 'tok-new';
      field.dispatchEvent(new Event('input'));

      (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
      const request = http.expectOne((r) => r.method === 'PUT');
      expect(request.request.body.values.Token).toBe('tok-new');
      request.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('removes the secret only when Clear is pressed, and then shows Not set', () => {
      const { fixture, page, http } = setupSecret();

      (page.querySelector('button.setting-field__clear') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(page.textContent).toContain('will be removed');
      (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
      const request = http.expectOne((r) => r.method === 'PUT');

      expect(request.request.body.clear).toEqual(['Token']);
      request.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('reads the settings again after a save, so the set state comes from the server', () => {
      const { fixture, page, http } = setupSecret({ ...secretModel, secretsSet: [] });
      const field = page.querySelector('input[name="Token"]') as HTMLInputElement;
      field.value = 'tok-new';
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
      http.expectOne((r) => r.method === 'PUT').flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne((r) => r.method === 'GET').flush({ ...secretModel, secretsSet: ['Token'] });
      fixture.detectChanges();

      expect((page.querySelector('input[name="Token"]') as HTMLInputElement).value).toBe('');
      expect(page.textContent).toContain('A value is set');
    });
  });

  describe('the E-mail plug-in', () => {
    it('has no test box on other plug-ins', () => {
      const { page } = setup('html-sanitizer');
      expect(page.querySelector('[data-action="send-test"]')).toBeNull();
    });

    it('sends a test message to the address typed, and says it was sent', () => {
      const { fixture, http, page } = setup('mail');
      const to = page.querySelector('input[name="testTo"]') as HTMLInputElement;
      to.value = 'me@example.net';
      to.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      (page.querySelector('[data-action="send-test"]') as HTMLButtonElement).click();
      const post = http.expectOne((r) => r.url.endsWith('/api/mail/test') && r.method === 'POST');
      expect(post.request.body).toEqual({ to: 'me@example.net' });
      post.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();

      expect(page.querySelector('[data-test-result]')?.textContent).toContain('sent');
    });

    it('shows the server reason when the test fails, and asks for an address first', () => {
      const { fixture, http, page } = setup('mail');
      (page.querySelector('[data-action="send-test"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url.endsWith('/api/mail/test'));
      expect(page.querySelector('[data-test-result]')?.textContent).toContain('address');

      const to = page.querySelector('input[name="testTo"]') as HTMLInputElement;
      to.value = 'me@example.net';
      to.dispatchEvent(new Event('input'));
      (page.querySelector('[data-action="send-test"]') as HTMLButtonElement).click();
      http.expectOne((r) => r.url.endsWith('/api/mail/test')).flush('The mail server is not set.', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(page.querySelector('[data-test-result]')?.textContent).toContain('not set');
    });
  });
});
