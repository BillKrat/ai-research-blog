import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { WidgetZone } from './widget-zone';

describe('WidgetZone', () => {
  function setup(zone: string) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(WidgetZone);
    fixture.componentRef.setInput('zone', zone);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return { fixture, http, page: fixture.nativeElement as HTMLElement };
  }

  const widget = (id: string, title: string, html: string) => ({ id, widgetKey: 'k', title, html });

  it('asks the API for its own zone and shows each widget with its title and HTML, in order', () => {
    const { fixture, http, page } = setup('left');

    http.expectOne((r) => r.url.endsWith('/api/public/widgets/left') && r.method === 'GET').flush([widget('1', 'First', '<p>one</p>'), widget('2', 'Second', '<p>two</p>')]);
    fixture.detectChanges();

    const sections = Array.from(page.querySelectorAll('section.widget'));
    expect(sections.map((s) => s.querySelector('h3')?.textContent)).toEqual(['First', 'Second']);
    expect(sections[0].querySelector('p')?.textContent).toBe('one');
    expect(page.classList.contains('widget-zone--empty')).toBe(false);
  });

  it('shows the server-cleaned HTML as it is (the server sanitiser plug-in decides what is safe)', () => {
    const { fixture, http, page } = setup('right');

    http.expectOne((r) => r.url.endsWith('/api/public/widgets/right')).flush([widget('1', 'Styled', '<p style="color: red">red</p>')]);
    fixture.detectChanges();

    expect((page.querySelector('p') as HTMLElement).getAttribute('style')).toContain('color');
  });

  it('draws nothing at all when the zone is empty, and marks itself so the layout can close the gap', () => {
    const { fixture, http, page } = setup('footer');

    http.expectOne((r) => r.url.endsWith('/api/public/widgets/footer')).flush([]);
    fixture.detectChanges();

    expect(page.querySelector('section')).toBeNull();
    expect(page.classList.contains('widget-zone--empty')).toBe(true);
  });

  it('is empty, and never an error on the page, when the request fails', () => {
    const { fixture, http, page } = setup('header');

    http.expectOne((r) => r.url.endsWith('/api/public/widgets/header')).flush('no', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(page.querySelector('section')).toBeNull();
    expect(page.classList.contains('widget-zone--empty')).toBe(true);
  });

  it('turns a click on a link to this site into router navigation, and leaves other links alone', () => {
    const { fixture, http, page } = setup('right');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http.expectOne((r) => r.url.endsWith('/api/public/widgets/right')).flush([widget('1', 'Links', '<a id="inside" href="/tag/angular">tag</a> <a id="outside" href="https://example.org/x">x</a>')]);
    fixture.detectChanges();

    const inside = new MouseEvent('click', { bubbles: true, cancelable: true });
    page.querySelector('#inside')!.dispatchEvent(inside);
    const outside = new MouseEvent('click', { bubbles: true, cancelable: true });
    page.querySelector('#outside')!.dispatchEvent(outside);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/tag/angular');
    expect(inside.defaultPrevented).toBe(true);
    expect(outside.defaultPrevented).toBe(false);
  });

  it('stays hidden, and says it is still loading, until its answer arrives, then shows (no widget pops in at the wrong place)', () => {
    const { fixture, http, page } = setup('left');

    expect(page.classList.contains('widget-zone--empty')).toBe(true);
    expect(page.getAttribute('data-loaded')).toBe('false');

    http.expectOne((r) => r.url.endsWith('/api/public/widgets/left')).flush([widget('1', 'Shown', '<p>x</p>')]);
    fixture.detectChanges();

    expect(page.getAttribute('data-loaded')).toBe('true');
    expect(page.classList.contains('widget-zone--empty')).toBe(false);
  });
});
