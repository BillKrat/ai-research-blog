import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActingTenantService } from '@adventures/core';
import { TenantService } from '../../services/tenant.service';
import { TenantPanel } from './tenant-panel';

describe('TenantPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function renderWithTenant(answer: object): HTMLElement {
    const fixture = TestBed.createComponent(TenantPanel);
    TestBed.inject(TenantService).load();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/tenant/current')).flush(answer);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('shows the tenant the domain names, so it is always clear which one is being administered', () => {
    const root = renderWithTenant({ host: 'www.adventuresedge.net', tenant: { id: 't3', name: 'Adventures Edge', domain: 'adventuresEdge.net' }, match: 'Domain' });

    const badge = root.querySelector('.tenant-panel__tenant') as HTMLElement;
    expect(badge.textContent).toContain('Adventures Edge');
    expect(badge.textContent).toContain('adventuresEdge.net');
    expect(badge.textContent).not.toContain('development');
  });

  it('says the tenant is a development stand-in when the host matched none and the fallback named it', () => {
    const root = renderWithTenant({ host: 'localhost:4200', tenant: { id: 't1', name: 'DEV Main', domain: 'global-webnet.com' }, match: 'Fallback' });

    const badge = root.querySelector('.tenant-panel__tenant') as HTMLElement;
    expect(badge.textContent).toContain('DEV Main');
    expect(badge.textContent).toContain('development');
    expect(badge.textContent).toContain('localhost:4200');
  });

  function renderSwitcher(rights: string[], hostAlias?: string): { root: HTMLElement; http: HttpTestingController; fixture: ReturnType<typeof TestBed.createComponent<TenantPanel>> } {
    const fixture = TestBed.createComponent(TenantPanel);
    TestBed.inject(TenantService).load();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/tenant/current')).flush({ host: 'localhost:7052', tenant: { id: 't1', name: 'DEV Main', domain: 'global-webnet.com' }, match: 'Fallback' });
    http
      .expectOne((r) => r.url.endsWith('/api/tenant/mine'))
      .flush({
        actingId: 't1',
        tenants: [
          { id: 't1', name: 'DEV Main', domain: 'global-webnet.com', aliases: [] },
          { id: 't2', name: 'Adventures Edge', domain: 'adventuresEdge.net', aliases: [] },
        ],
      });
    http.expectOne((r) => r.url.endsWith('/api/auth/rights')).flush({ userName: 'Admin', rights: rights.map((name) => ({ name, description: '' })) });
    if (rights.includes('platform.manage')) {
      http
        .expectOne((r) => r.url.endsWith('/api/tenant/hosts'))
        .flush([
          { id: 't1', name: 'DEV Main', domain: 'global-webnet.com', aliases: hostAlias ? ['temp.example', hostAlias] : ['temp.example'] },
          { id: 't2', name: 'Adventures Edge', domain: 'adventuresEdge.net', aliases: [] },
        ]);
    }
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, http, fixture };
  }

  it('offers the tenants the person may work in, with the current one selected', () => {
    const { root } = renderSwitcher(['admin.access']);

    const options = Array.from(root.querySelectorAll('select[aria-label="Work in tenant"] option')) as HTMLOptionElement[];
    expect(options.map((o) => o.textContent?.trim())).toEqual(['DEV Main', 'Adventures Edge']);
    expect(options[0].selected).toBe(true);
    expect(root.querySelector('.tenant-panel__hosts')).toBeNull();
  });

  it('remembers the choice and reloads when another tenant is picked', () => {
    const { root, fixture } = renderSwitcher(['admin.access']);
    const acting = TestBed.inject(ActingTenantService);
    const reload = vi.spyOn(acting, 'reload').mockImplementation(() => undefined);
    const select = root.querySelector('select[aria-label="Work in tenant"]') as HTMLSelectElement;

    select.value = 't2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(acting.id()).toBe('t2');
    expect(reload).toHaveBeenCalled();
    acting.choose(null);
  });

  it('shows host names to a platform administrator and adds the current host to the chosen tenant', () => {
    const { root, http, fixture } = renderSwitcher(['admin.access', 'platform.manage']);

    expect(root.querySelector('.tenant-panel__hosts')?.textContent).toContain('temp.example');
    const select = root.querySelector('select[aria-label="Tenant to mirror"]') as HTMLSelectElement;
    select.value = 't2';
    select.dispatchEvent(new Event('change'));
    (root.querySelector('.tenant-panel__mirror') as HTMLButtonElement).click();
    fixture.detectChanges();

    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/tenant/t2/aliases'));
    expect(put.request.body).toEqual({ host: 'localhost:7052' });
    put.flush('localhost already reaches another tenant.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root.querySelector('.tenant-panel__problem')?.textContent).toContain('already reaches another tenant');
  });

  it('takes the host back to its default: Default removes the alias from the tenant that mirrors it', () => {
    const { root, http, fixture } = renderSwitcher(['admin.access', 'platform.manage'], 'localhost');

    const select = root.querySelector('select[aria-label="Tenant to mirror"]') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    (root.querySelector('.tenant-panel__mirror') as HTMLButtonElement).click();
    fixture.detectChanges();

    const removal = http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/tenant/t1/aliases/localhost'));
    removal.flush([]);
  });

  it('says so when Default is applied to a host that mirrors nothing', () => {
    const { root, fixture } = renderSwitcher(['admin.access', 'platform.manage']);

    const select = root.querySelector('select[aria-label="Tenant to mirror"]') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    (root.querySelector('.tenant-panel__mirror') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelector('.tenant-panel__problem')?.textContent).toContain('is not mirroring any tenant');
  });

  it('says no tenant matches the domain, naming the domain, instead of showing nothing', () => {
    const root = renderWithTenant({ host: 'stranger.example', tenant: null, match: 'None' });

    expect((root.querySelector('.tenant-panel__tenant') as HTMLElement).textContent).toContain('No tenant for stranger.example');
  });
});
