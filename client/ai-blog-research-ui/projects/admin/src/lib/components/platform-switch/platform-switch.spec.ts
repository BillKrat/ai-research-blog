import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlatformSwitch } from './platform-switch';

describe('PlatformSwitch', () => {
  let http: HttpTestingController;

  function render(state: { isPlatformAdministrator: boolean; canChange: boolean }) {
    TestBed.configureTestingModule({ imports: [PlatformSwitch], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(PlatformSwitch);
    fixture.componentRef.setInput('userId', 'u 1');
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/users/u%201/platform') && r.method === 'GET').flush(state);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the switch as the server reports it, and who may change it', () => {
    const root = render({ isPlatformAdministrator: true, canChange: true }).nativeElement as HTMLElement;

    const toggle = root.querySelector('mat-slide-toggle') as HTMLElement;
    expect(toggle.textContent).toContain('Platform administrator');
    expect(toggle.querySelector('button')?.getAttribute('aria-checked')).toBe('true');
    expect(root.textContent).not.toContain('Only a platform administrator can change it');
  });

  it('is read only for someone who is not a platform administrator, and says why', () => {
    const root = render({ isPlatformAdministrator: false, canChange: false }).nativeElement as HTMLElement;

    expect((root.querySelector('mat-slide-toggle button') as HTMLButtonElement).disabled).toBe(true);
    expect(root.textContent).toContain('Only a platform administrator can change it');
  });

  it('sends the new state when switched, and shows the servers refusal in its words', () => {
    const fixture = render({ isPlatformAdministrator: true, canChange: true });
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('mat-slide-toggle button') as HTMLButtonElement).click();
    const put = http.expectOne((r) => r.url.endsWith('/api/users/u%201/platform') && r.method === 'PUT');
    expect(put.request.body).toEqual({ on: false });
    put.flush('This is the last platform administrator.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(root.querySelector('.platform-switch__error')?.textContent).toContain('last platform administrator');
  });
});
