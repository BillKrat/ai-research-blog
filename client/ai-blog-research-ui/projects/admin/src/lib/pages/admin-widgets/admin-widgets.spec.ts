import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpinnerService } from '@adventures/core';
import { AdminWidgets } from './admin-widgets';

describe('AdminWidgets', () => {
  const overview = {
    zones: ['header', 'left', 'right', 'footer'],
    available: [
      { pluginKey: 'widgets', definition: { key: 'text-box', title: 'Text box', description: 'Your own text.', settings: [{ name: 'Content', label: 'Content', description: 'The text.', kind: 'Lines', default: '', maxLength: 4000 }] } },
      { pluginKey: 'widgets', definition: { key: 'tag-cloud', title: 'Tag cloud', description: 'Tags.', settings: [] } },
    ],
    placements: [
      { id: 'p1', zone: 'left', widgetKey: 'text-box', title: 'About', settings: { Content: 'hello' }, position: 1, available: true },
      { id: 'p2', zone: 'left', widgetKey: 'tag-cloud', title: null, settings: {}, position: 2, available: true },
      { id: 'p3', zone: 'right', widgetKey: 'gone-widget', title: null, settings: {}, position: 1, available: false },
    ],
  };

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(AdminWidgets);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/widgets') && r.method === 'GET').flush(overview);
    fixture.detectChanges();
    return { fixture, http, page: fixture.nativeElement as HTMLElement };
  }

  const reload = (http: HttpTestingController) => http.expectOne((r) => r.url.endsWith('/api/widgets') && r.method === 'GET').flush(overview);
  const zone = (page: HTMLElement, name: string) => page.querySelector(`section[data-zone="${name}"]`) as HTMLElement;

  it('shows the four zones with their placed widgets in order, naming each by its title or its widget', () => {
    const { page } = setup();

    expect(Array.from(page.querySelectorAll('section[data-zone]')).map((s) => s.getAttribute('data-zone'))).toEqual(['header', 'left', 'right', 'footer']);
    expect(Array.from(zone(page, 'left').querySelectorAll('li.placement .placement__name')).map((n) => n.textContent?.trim())).toEqual(['About', 'Tag cloud']);
  });

  it('flags a placement whose widget is not available, and keeps it removable', () => {
    const { page } = setup();

    const gone = zone(page, 'right').querySelector('li.placement') as HTMLElement;
    expect(gone.textContent).toContain('not available');
    expect(gone.querySelector('button[aria-label^="Remove"]')).not.toBeNull();
  });

  it('adds the chosen widget to a zone and reads the layout again', () => {
    const { fixture, http, page } = setup();
    const select = zone(page, 'footer').querySelector('select') as HTMLSelectElement;
    select.value = 'tag-cloud';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (zone(page, 'footer').querySelector('button[data-action="add"]') as HTMLButtonElement).click();
    const request = http.expectOne((r) => r.url.endsWith('/api/widgets/placements') && r.method === 'POST');
    expect(request.request.body).toEqual({ zone: 'footer', widgetKey: 'tag-cloud', title: null, settings: {} });
    request.flush({});
    reload(http);
  });

  it('removes a placement, and moves one up and down', () => {
    const { http, page } = setup();

    (zone(page, 'left').querySelector('li.placement:nth-child(1) button[aria-label^="Remove"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/api/widgets/placements/p1') && r.method === 'DELETE').flush(null, { status: 204, statusText: 'No Content' });
    reload(http);

    (zone(page, 'left').querySelector('li.placement:nth-child(2) button[aria-label^="Move up"]') as HTMLButtonElement).click();
    const up = http.expectOne((r) => r.url.endsWith('/api/widgets/placements/p2/move'));
    expect(up.request.body).toEqual({ direction: -1 });
    up.flush(null, { status: 204, statusText: 'No Content' });
    reload(http);

    (zone(page, 'left').querySelector('li.placement:nth-child(1) button[aria-label^="Move down"]') as HTMLButtonElement).click();
    expect(http.expectOne((r) => r.url.endsWith('/api/widgets/placements/p1/move')).request.body).toEqual({ direction: 1 });
  });

  it('edits a placement with the form its widget declared, and saves title and settings', () => {
    const { fixture, http, page } = setup();

    (zone(page, 'left').querySelector('li.placement:nth-child(1) button[aria-label^="Edit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const title = page.querySelector('input[name="placementTitle"]') as HTMLInputElement;
    title.value = 'Renamed';
    title.dispatchEvent(new Event('input'));
    const content = page.querySelector('textarea[name="Content"]') as HTMLTextAreaElement;
    expect(content.value).toBe('hello');
    content.value = 'new text';
    content.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (page.querySelector('button[data-action="save"]') as HTMLButtonElement).click();
    const request = http.expectOne((r) => r.url.endsWith('/api/widgets/placements/p1') && r.method === 'PUT');
    expect(request.request.body).toEqual({ title: 'Renamed', settings: { Content: 'new text' } });
    request.flush({});
    reload(http);
  });

  it('shows the reason when a change is refused', () => {
    const { fixture, http, page } = setup();
    const select = zone(page, 'header').querySelector('select') as HTMLSelectElement;
    select.value = 'text-box';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (zone(page, 'header').querySelector('button[data-action="add"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'POST').flush('That widget cannot be placed.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(page.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('keeps the controls disabled, and the global spinner on, while a change is on its way, then lets go when the layout is back', () => {
    const { fixture, http, page } = setup();
    const spinner = TestBed.inject(SpinnerService);
    expect(spinner.active()).toBe(false);

    (zone(page, 'left').querySelector('li.placement:nth-child(2) button[aria-label^="Move up"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(spinner.active()).toBe(true);
    expect(Array.from(page.querySelectorAll('button')).every((b) => (b as HTMLButtonElement).disabled)).toBe(true);

    http.expectOne((r) => r.url.endsWith('/api/widgets/placements/p2/move')).flush(null, { status: 204, statusText: 'No Content' });
    expect(spinner.active()).toBe(true);
    reload(http);
    fixture.detectChanges();

    expect(spinner.active()).toBe(false);
    expect(Array.from(page.querySelectorAll('button')).some((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('lets go of the spinner and the controls when a change is refused', () => {
    const { fixture, http, page } = setup();
    const spinner = TestBed.inject(SpinnerService);

    (zone(page, 'left').querySelector('li.placement:nth-child(1) button[aria-label^="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(spinner.active()).toBe(true);
    http.expectOne((r) => r.method === 'DELETE').flush('no', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(spinner.active()).toBe(false);
  });
});
