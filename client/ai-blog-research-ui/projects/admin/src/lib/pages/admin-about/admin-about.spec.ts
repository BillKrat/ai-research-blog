import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { AdminAbout } from './admin-about';

describe('AdminAbout (DCP: the About page is the README, with help links)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminAbout], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMarkdown()] }).compileComponents();
  });

  function render(readme: string) {
    const fixture = TestBed.createComponent(AdminAbout);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('about.md')).flush(readme);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the README text as the page', async () => {
    const root = render('# ai-research-blog\n\nAn AI starter kit.');
    await new Promise((resolve) => setTimeout(resolve, 50)); // the Markdown is turned into HTML asynchronously

    expect(root.textContent).toContain('An AI starter kit.');
  });

  it('offers help links to the Help and Development log categories and to all posts, each in a new tab', () => {
    const root = render('# x');

    const links = Array.from(root.querySelectorAll('.admin-about__help a')) as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://www.global-webnet.com/category/Help',
      'https://www.global-webnet.com/category/Development%20log',
      'https://www.global-webnet.com/posts',
    ]);
    expect(links.every((a) => a.getAttribute('target') === '_blank' && (a.getAttribute('rel') ?? '').includes('noopener'))).toBe(true);
  });

  it('says so when the README could not be read', () => {
    const fixture = TestBed.createComponent(AdminAbout);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('about.md')).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('could not be read');
  });
});
