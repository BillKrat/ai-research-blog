import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RightsChecklist } from './rights-checklist';

const catalog = [
  { name: 'admin.access', description: 'See the admin area at all.' },
  { name: 'posts.read', description: 'See the list of posts and open them.' },
  { name: 'users.manage', description: 'Add people, set passwords, assign roles.' },
];

describe('RightsChecklist', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<RightsChecklist>;

  async function open(rights: string, canEdit = true, rightsCatalog = catalog): Promise<HTMLElement> {
    fixture = TestBed.createComponent(RightsChecklist);
    fixture.componentRef.setInput('roleId', 'r1');
    fixture.componentRef.setInput('rights', rights);
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/roles/rights-catalog')).flush(rightsCatalog);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const boxes = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RightsChecklist],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('lists every right with its description, ticked for the ones the role holds', async () => {
    const el = await open('admin.access,users.manage');

    expect(boxes(el).map((b) => b.checked)).toEqual([true, false, true]);
    expect(el.textContent).toContain('Add people, set passwords, assign roles.');
  });

  it('lists the rights alphabetically by name whatever order the server sends', async () => {
    const el = await open('posts.read', true, [
      { name: 'users.manage', description: 'Add people.' },
      { name: 'Posts.create', description: 'Write posts.' },
      { name: 'admin.access', description: 'See the admin area.' },
      { name: 'posts.read', description: 'See posts.' },
    ]);

    const names = Array.from(el.querySelectorAll('.rights__name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['admin.access', 'Posts.create', 'posts.read', 'users.manage']);
    expect(boxes(el).map((b) => b.checked)).toEqual([false, false, true, false]);
  });

  it('shows every right ticked for a role that holds all of them (*)', async () => {
    expect(boxes(await open('*')).every((b) => b.checked)).toBe(true);
  });

  it('saves the ticked rights to the role and tells the host', async () => {
    const el = await open('admin.access');
    let saved = 0;
    fixture.componentInstance.saved.subscribe(() => saved++);

    boxes(el)[1].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button.rights__save')!.click();

    const request = http.expectOne((r) => r.url.endsWith('/api/roles/r1/rights'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ rights: ['admin.access', 'posts.read'] });
    request.flush({ rights: ['admin.access', 'posts.read'] });
    expect(saved).toBe(1);
  });

  it('shows the server refusal in words and keeps the ticks', async () => {
    const el = await open('admin.access,users.manage');

    boxes(el)[2].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button.rights__save')!.click();
    http
      .expectOne((r) => r.url.endsWith('/api/roles/r1/rights'))
      .flush('You cannot take away your own ability to manage users and roles.', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')!.textContent).toContain('your own ability');
    expect(boxes(el)[2].checked).toBe(false);
  });

  it('is read-only when the caller cannot edit', async () => {
    const el = await open('admin.access', false);

    expect(boxes(el).every((b) => b.disabled)).toBe(true);
    expect(el.querySelector('button.rights__save')).toBeNull();
  });
});
