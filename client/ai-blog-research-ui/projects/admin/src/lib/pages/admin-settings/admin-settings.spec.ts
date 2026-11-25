import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminSettings, SETTING_GROUPS } from './admin-settings';

describe('AdminSettings', () => {
  const row = (id: string, name: string, value: string) => ({ entityId: id, values: { Name: name, Value: value, Description: `About ${name}` } });
  const grid = {
    schema: { name: 'SiteSetting', fields: [] },
    rows: [
      row('1', 'SiteTitle', 'My Blog'),
      row('2', 'Tagline', ''),
      row('3', 'PostsPerPage', '10'),
      row('4', 'CommentsEnabled', 'true'),
      row('5', 'FeedItems', '20'),
      row('6', 'TimeZone', 'UTC'),
    ],
  };

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(AdminSettings);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/settings') && r.method === 'GET' && r.params.get('pageSize') === '100').flush(grid);
    fixture.detectChanges();
    return { fixture, http, page: fixture.nativeElement as HTMLElement };
  }

  const tab = (page: HTMLElement, name: string) => Array.from(page.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent?.includes(name))!;

  it('groups the settings like the legacy screen: Basic, E-mail, Feed, Comments, Advanced', () => {
    const { page } = setup();
    const names = Array.from(page.querySelectorAll('[role="tab"]')).map((b) => b.textContent?.trim());
    expect(names).toEqual(['Basic', 'E-mail', 'Feed', 'Comments', 'Advanced']);
  });

  it('shows the Basic fields first, filled with the saved values', () => {
    const { page } = setup();
    expect((page.querySelector('input[name="SiteTitle"]') as HTMLInputElement).value).toBe('My Blog');
    expect((page.querySelector('input[type="number"][name="PostsPerPage"]') as HTMLInputElement).value).toBe('10');
    expect(page.querySelector('input[name="FeedItems"]')).toBeNull();
  });

  it('switches group without losing an unsaved edit', () => {
    const { fixture, page } = setup();
    const title = page.querySelector('input[name="SiteTitle"]') as HTMLInputElement;
    title.value = 'New';
    title.dispatchEvent(new Event('input'));
    tab(page, 'Comments').click();
    fixture.detectChanges();
    expect((page.querySelector('input[type="checkbox"][name="CommentsEnabled"]') as HTMLInputElement).checked).toBe(true);
    tab(page, 'Basic').click();
    fixture.detectChanges();
    expect((page.querySelector('input[name="SiteTitle"]') as HTMLInputElement).value).toBe('New');
  });

  it('saves only the settings that changed, by row, keeping the name and description', () => {
    const { fixture, http, page } = setup();
    const title = page.querySelector('input[name="SiteTitle"]') as HTMLInputElement;
    title.value = 'New';
    title.dispatchEvent(new Event('input'));
    (page.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    const put = http.expectOne((r) => r.url.endsWith('/api/settings/1') && r.method === 'PUT');
    expect(put.request.body.values).toEqual({ Name: 'SiteTitle', Value: 'New', Description: 'About SiteTitle' });
    http.expectNone((r) => r.method === 'PUT');
    put.flush({});
    fixture.detectChanges();
    expect(page.querySelector('.admin-settings__saved')).not.toBeNull();
  });

  it('E-mail leads to the e-mail plug-in screen, and every grouped setting is a known name once', () => {
    const { fixture, page } = setup();
    tab(page, 'E-mail').click();
    fixture.detectChanges();
    expect(page.querySelector('a[href="/admin/plugins/mail"]')).not.toBeNull();
    const all = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.name));
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the plain list reachable', () => {
    const { page } = setup();
    expect(page.querySelector('a[href="/admin/settings/all"]')).not.toBeNull();
  });
});
