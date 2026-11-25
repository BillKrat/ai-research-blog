import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContactPage } from './contact-page';

describe('ContactPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ContactPage], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
  });

  function render(info: object = { enabled: true, intro: 'Write to me.' }) {
    const fixture = TestBed.createComponent(ContactPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/public/contact')).flush(info);
    fixture.detectChanges();
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  }

  function fill(root: HTMLElement, values: Record<string, string>): void {
    for (const [name, value] of Object.entries(values)) {
      const field = root.querySelector(`[name=${name}]`) as HTMLInputElement | HTMLTextAreaElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
  }

  it('shows the intro and the form when the plug-in is on', () => {
    const { root } = render();

    expect(root.textContent).toContain('Write to me.');
    expect(root.querySelector('form')).not.toBeNull();
  });

  it('says the form is not available when the plug-in is off, and shows no form', () => {
    const { root } = render({ enabled: false, intro: '' });

    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('not available');
  });

  it('asks for a name, an address and a message before sending anything', () => {
    const { fixture, http, root } = render();
    fill(root, { name: 'Ann', message: 'Hello' });
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    http.expectNone((r) => r.method === 'POST');
    expect(root.querySelector('.contact__problem')?.textContent).toContain('name, an e-mail address and a message');
  });

  it('sends the message, thanks the visitor and clears the form', () => {
    const { fixture, http, root } = render();
    fill(root, { name: 'Ann', email: 'ann@example.org', message: 'Hello there' });

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/public/contact'));
    expect(post.request.body).toEqual({ name: 'Ann', email: 'ann@example.org', message: 'Hello there', website: '' });
    post.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();

    expect(root.querySelector('.contact__notice')?.textContent).toContain('Thank you');
    expect((root.querySelector('[name=message]') as HTMLTextAreaElement).value).toBe('');
  });

  it('shows the reason when the server refuses, and a calm line when sending is too fast', () => {
    const { fixture, http, root } = render();
    fill(root, { name: 'Ann', email: 'ann@example.org', message: 'Hello' });
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne((r) => r.method === 'POST').flush('The contact form is not set up yet: the owner has not given an address to send to.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root.querySelector('.contact__problem')?.textContent).toContain('not set up yet');

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne((r) => r.method === 'POST').flush(null, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(root.querySelector('.contact__problem')?.textContent).toContain('too quickly');
  });
});
