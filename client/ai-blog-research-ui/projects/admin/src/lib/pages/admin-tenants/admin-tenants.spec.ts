import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminTenants } from './admin-tenants';

describe('AdminTenants', () => {
  const hosts = [
    { id: 't1', name: 'DEV Main', domain: 'global-webnet.com', aliases: ['old.example'] },
    { id: 't2', name: 'Adventures Edge', domain: 'adventuresontheedge.net', aliases: [] },
  ];

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(AdminTenants);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/tenant/hosts') && r.method === 'GET').flush(hosts);
    fixture.detectChanges();
    return { fixture, http, page: fixture.nativeElement as HTMLElement };
  }

  function type(page: HTMLElement, label: string, value: string): void {
    const input = page.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('lists every tenant with its domain and its host names', () => {
    const { page } = setup();

    expect(page.textContent).toContain('DEV Main');
    expect(page.textContent).toContain('global-webnet.com');
    expect(page.textContent).toContain('old.example');
    expect(page.textContent).toContain('Adventures Edge');
  });

  it('adds a host name typed for a tenant, with the address pasted as it is (a scheme is fine), and says it works at once', () => {
    const { fixture, http, page } = setup();
    type(page, 'New host name for DEV Main', 'http://billkrat-001-site1.atempurl.com');
    fixture.detectChanges();

    (page.querySelector('button[aria-label="Add host name to DEV Main"]') as HTMLButtonElement).click();
    const put = http.expectOne((r) => r.url.endsWith('/api/tenant/t1/aliases') && r.method === 'PUT');
    expect(put.request.body).toEqual({ host: 'http://billkrat-001-site1.atempurl.com' });
    put.flush(['old.example', 'billkrat-001-site1.atempurl.com']);
    http.expectOne((r) => r.url.endsWith('/api/tenant/hosts')).flush([
      { ...hosts[0], aliases: ['old.example', 'billkrat-001-site1.atempurl.com'] },
      hosts[1],
    ]);
    fixture.detectChanges();

    expect(page.textContent).toContain('billkrat-001-site1.atempurl.com');
    expect(page.querySelector('[role="status"]')?.textContent).toContain('works now');
    expect((page.querySelector('input[aria-label="New host name for DEV Main"]') as HTMLInputElement).value).toBe('');
  });

  it('does nothing for an empty host name', () => {
    const { page, http } = setup();

    (page.querySelector('button[aria-label="Add host name to DEV Main"]') as HTMLButtonElement).click();

    http.expectNone((r) => r.method === 'PUT');
  });

  it('shows the reason when the server refuses a host name (it already reaches another tenant)', () => {
    const { fixture, http, page } = setup();
    type(page, 'New host name for Adventures Edge', 'global-webnet.com');
    fixture.detectChanges();

    (page.querySelector('button[aria-label="Add host name to Adventures Edge"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'PUT').flush('global-webnet.com already reaches DEV Main. A host name can belong to only one tenant.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('already reaches DEV Main');
  });

  it('removes a host name and says so', () => {
    const { fixture, http, page } = setup();

    (page.querySelector('button[aria-label="Remove old.example"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/api/tenant/t1/aliases/old.example') && r.method === 'DELETE').flush([]);
    http.expectOne((r) => r.url.endsWith('/api/tenant/hosts')).flush([{ ...hosts[0], aliases: [] }, hosts[1]]);
    fixture.detectChanges();

    expect(page.querySelector('button[aria-label="Remove old.example"]')).toBeNull();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Removed old.example');
  });

  describe('deleting a tenant', () => {
    function startDelete(page: HTMLElement, fixture: { detectChanges(): void }, name: string): void {
      (page.querySelector(`button[aria-label="Delete ${name}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('asks for the tenant domain to be typed, and only then enables the final button', () => {
      const { fixture, page } = setup();
      startDelete(page, fixture, 'Adventures Edge');
      const confirmButton = page.querySelector('button[aria-label="Confirm delete of Adventures Edge"]') as HTMLButtonElement;

      expect(confirmButton.disabled).toBe(true);
      type(page, 'Type adventuresontheedge.net to confirm', 'adventuresontheedge');
      fixture.detectChanges();
      expect(confirmButton.disabled).toBe(true);
      type(page, 'Type adventuresontheedge.net to confirm', ' AdventuresOnTheEdge.net ');
      fixture.detectChanges();
      expect(confirmButton.disabled).toBe(false);
    });

    it('deletes with the typed domain, reloads the list and says so', () => {
      const { fixture, http, page } = setup();
      startDelete(page, fixture, 'Adventures Edge');
      type(page, 'Type adventuresontheedge.net to confirm', 'adventuresontheedge.net');
      fixture.detectChanges();

      (page.querySelector('button[aria-label="Confirm delete of Adventures Edge"]') as HTMLButtonElement).click();
      const request = http.expectOne((r) => r.method === 'DELETE' && r.url.includes('/api/tenant/t2'));
      expect(request.request.params.get('confirm') ?? new URL(request.request.urlWithParams, 'http://x').searchParams.get('confirm')).toBe('adventuresontheedge.net');
      request.flush({ id: 't2', name: 'Adventures Edge', domain: 'adventuresontheedge.net', aliases: [] });
      http.expectOne((r) => r.url.endsWith('/api/tenant/hosts')).flush([hosts[0]]);
      fixture.detectChanges();

      expect(page.textContent).not.toContain('Delete Adventures Edge');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Deleted Adventures Edge');
    });

    it('shows the reason when the server refuses (the tenant you are working in, the last tenant)', () => {
      const { fixture, http, page } = setup();
      startDelete(page, fixture, 'DEV Main');
      type(page, 'Type global-webnet.com to confirm', 'global-webnet.com');
      fixture.detectChanges();

      (page.querySelector('button[aria-label="Confirm delete of DEV Main"]') as HTMLButtonElement).click();
      http.expectOne((r) => r.method === 'DELETE').flush('DEV Main is the tenant you are working in.', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('the tenant you are working in');
    });

    it('can be cancelled', () => {
      const { fixture, http, page } = setup();
      startDelete(page, fixture, 'Adventures Edge');

      (page.querySelector('button[aria-label="Cancel delete of Adventures Edge"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(page.querySelector('button[aria-label="Confirm delete of Adventures Edge"]')).toBeNull();
      http.expectNone((r) => r.method === 'DELETE');
    });
  });

  it('explains that the tenant of a request is decided by the address the API is reached on', () => {
    const { page } = setup();

    expect(page.textContent).toContain('temporary address');
  });

  describe('creating a tenant', () => {
    function fill(page: HTMLElement, name: string, value: string): void {
      const input = page.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }

    it('creates a tenant from a name and a domain, says so, and reads the list again', () => {
      const { fixture, http, page } = setup();
      fill(page, 'newTenantName', ' Photos by Di ');
      fill(page, 'newTenantDomain', 'https://photos.example.org/');
      fixture.detectChanges();

      (page.querySelector('[data-action="create-tenant"]') as HTMLButtonElement).click();
      const post = http.expectOne((r) => r.url.endsWith('/api/tenant') && r.method === 'POST');
      expect(post.request.body).toEqual({ name: 'Photos by Di', domain: 'https://photos.example.org/' });
      post.flush({ id: 't3', name: 'Photos by Di', domain: 'photos.example.org', aliases: [] }, { status: 201, statusText: 'Created' });
      http.expectOne((r) => r.url.endsWith('/api/tenant/hosts') && r.method === 'GET').flush(hosts);
      fixture.detectChanges();

      expect(page.querySelector('[role="status"]')?.textContent).toContain('Photos by Di');
      expect((page.querySelector('input[name="newTenantName"]') as HTMLInputElement).value).toBe('');
    });

    it('asks for both fields before sending anything', () => {
      const { fixture, http, page } = setup();
      fill(page, 'newTenantName', 'Photos');
      fixture.detectChanges();

      (page.querySelector('[data-action="create-tenant"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      http.expectNone((r) => r.method === 'POST');
      expect(page.querySelector('[role="alert"]')?.textContent).toContain('name and a domain');
    });

    it('shows the reason when the server refuses (the domain already reaches another tenant)', () => {
      const { fixture, http, page } = setup();
      fill(page, 'newTenantName', 'Thief');
      fill(page, 'newTenantDomain', 'global-webnet.com');

      (page.querySelector('[data-action="create-tenant"]') as HTMLButtonElement).click();
      http.expectOne((r) => r.url.endsWith('/api/tenant') && r.method === 'POST').flush('global-webnet.com already reaches DEV Main.', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('already reaches DEV Main');
    });
  });
});
