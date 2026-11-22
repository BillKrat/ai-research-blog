import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LABELS } from '@adventures/entity-ui';
import { AdminLanguages } from './admin-languages';

describe('AdminLanguages', () => {
  function setup(stored = [{ language: 'de', count: 2 }]) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(AdminLanguages);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/languages') && r.method === 'GET').flush(stored);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const el = page.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      el.value = value;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const press = (action: string) => {
      (page.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, http, page, type, press };
  }

  it('lists the stored languages with how many texts each holds', () => {
    const { page } = setup([{ language: 'de', count: 2 }, { language: 'fr', count: 1 }]);

    expect(Array.from(page.querySelectorAll('li.languages__item')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      expect.stringContaining('de (2'),
      expect.stringContaining('fr (1'),
    ]);
  });

  it('opens a language into the editor as a table the owner can change', () => {
    const { http, page, press, fixture } = setup();

    press('open-de');
    http.expectOne((r) => r.url.endsWith('/api/languages/de') && r.method === 'GET').flush({ language: 'de', labels: { save: 'Speichern' } });
    fixture.detectChanges();

    expect((page.querySelector('input[name="code"]') as HTMLInputElement).value).toBe('de');
    expect(JSON.parse((page.querySelector('textarea[name="table"]') as HTMLTextAreaElement).value)).toEqual({ save: 'Speichern' });
  });

  it('fills the editor with every English text on request, so a translator has the whole list of keys', () => {
    const { page, press } = setup([]);

    press('english');

    expect(Object.keys(JSON.parse((page.querySelector('textarea[name="table"]') as HTMLTextAreaElement).value)).length).toBe(Object.keys(LABELS).length);
  });

  it('saves the table under the code, then reads the list again', () => {
    const { http, type, press, fixture } = setup([]);
    type('input[name="code"]', 'DE');
    type('textarea[name="table"]', '{"save":"Speichern"}');

    press('save');
    const put = http.expectOne((r) => r.url.endsWith('/api/languages/de') && r.method === 'PUT');
    expect(put.request.body).toEqual({ labels: { save: 'Speichern' } });
    put.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/api/languages') && r.method === 'GET').flush([{ language: 'de', count: 1 }]);
  });

  it('refuses a table that is not a JSON object of texts, and sends nothing', () => {
    const { http, page, type, press } = setup([]);
    type('input[name="code"]', 'de');

    for (const bad of ['not json', '[1,2]', '{"save": 7}', '']) {
      type('textarea[name="table"]', bad);
      press('save');
      expect(page.querySelector('[role="alert"]')?.textContent).toContain('table');
    }

    http.expectNone((r) => r.method === 'PUT');
  });

  it('shows the reason when the server refuses the file', () => {
    const { http, page, type, press, fixture } = setup([]);
    type('input[name="code"]', 'de');
    type('textarea[name="table"]', '{"save":"x"}');

    press('save');
    http.expectOne((r) => r.method === 'PUT').flush('The text for save is empty.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('empty');
  });

  it('removes the opened language and reads the list again', () => {
    const { http, press, fixture } = setup();
    press('open-de');
    http.expectOne((r) => r.url.endsWith('/api/languages/de') && r.method === 'GET').flush({ language: 'de', labels: { save: 'S' } });
    fixture.detectChanges();

    press('remove');
    http.expectOne((r) => r.url.endsWith('/api/languages/de') && r.method === 'DELETE').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/api/languages') && r.method === 'GET').flush([]);
  });
});
