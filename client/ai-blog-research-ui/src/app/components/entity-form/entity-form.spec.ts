import { provideMarkdown } from 'ngx-markdown';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { EntityForm } from './entity-form';
import { EntityFormModel } from '../../models/entity-form.model';

function buildModel(): EntityFormModel {
  return {
    schema: {
      schemaIri: 'https://global-webnet.com/schema/User',
      fields: [
        { name: 'UserName', type: 'String', isRequired: true },
        { name: 'Email', type: 'String', isRequired: false },
      ],
    },
    entity: {
      entityId: 'user-1',
      values: { UserName: 'BillKrat', Email: 'bill@adventuresontheedge.net' },
    },
  };
}

/** Setting @Input()-bound properties directly (not through a host template) does not trigger
 * ngOnChanges on its own - this mirrors what Angular's own binding mechanism would do. */
function applyModel(fixture: ComponentFixture<EntityForm>, model: EntityFormModel): void {
  const previous = fixture.componentInstance.model;
  fixture.componentInstance.model = model;
  fixture.componentInstance.ngOnChanges({ model: new SimpleChange(previous, model, previous === undefined) });
}

describe('EntityForm', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EntityForm] }).compileComponents();
  });

  it('renders one control per schema field, pre-filled from the entity values', () => {
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, buildModel());
    fixture.detectChanges();

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
    expect(inputs.length).toBe(2);
    expect(fixture.componentInstance.form.value).toEqual({
      UserName: 'BillKrat',
      Email: 'bill@adventuresontheedge.net',
    });
  });

  it('rebuilds the form when a new model is bound', () => {
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, buildModel());
    fixture.detectChanges();

    applyModel(fixture, {
      schema: { schemaIri: 'x', fields: [{ name: 'DisplayName', type: 'String', isRequired: false }] },
      entity: { entityId: 'user-1', values: { DisplayName: 'Bill' } },
    });
    fixture.detectChanges();

    expect(Object.keys(fixture.componentInstance.form.controls)).toEqual(['DisplayName']);
  });

  it('emits the current form values on submit', () => {
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, buildModel());
    fixture.detectChanges();

    let emitted: Record<string, string | null> | undefined;
    fixture.componentInstance.save.subscribe((values) => (emitted = values));

    fixture.componentInstance.form.controls['Email'].setValue('new@example.com');
    fixture.componentInstance.submit();

    expect(emitted).toEqual({ UserName: 'BillKrat', Email: 'new@example.com' });
  });

  function typedModel(): EntityFormModel {
    return {
      contractVersion: 1,
      permissions: { canUpdate: true, canDelete: false },
      schema: {
        schemaIri: 'x',
        fields: [
          { name: 'DOB', type: 'DATE', isRequired: false, label: 'Born', order: 20 },
          { name: 'Id', type: 'Guid', isRequired: false, label: 'Id', isReadOnly: true, order: 0 },
          { name: 'Active', type: 'Bool', isRequired: false, label: 'Is active', order: 30 },
          { name: 'Age', type: 'Int', isRequired: false, label: 'Age', order: 10 },
        ],
      },
      entity: { entityId: 'u1', values: { DOB: '1961-11-19', Id: 'u1', Active: 'true', Age: '64' } },
    };
  }

  it('uses the server label and order, and picks the control from the type', () => {
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, typedModel());
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.fields.map((f) => f.name)).toEqual(['Id', 'Age', 'DOB', 'Active']);
    expect(root.querySelector('input[type="date"]')).not.toBeNull();
    expect(root.querySelector('input[type="number"]')).not.toBeNull();
    expect(root.querySelector('mat-checkbox')).not.toBeNull();
    expect(root.textContent).toContain('Born');
    expect(root.textContent).toContain('Is active');
  });

  it('disables a read-only field but still sends its value back unchanged, with booleans as true/false text', () => {
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, typedModel());
    fixture.detectChanges();
    let emitted: Record<string, string | null> | undefined;
    fixture.componentInstance.save.subscribe((values) => (emitted = values));

    expect(fixture.componentInstance.form.controls['Id'].disabled).toBe(true);
    fixture.componentInstance.form.controls['Active'].setValue(false);
    fixture.componentInstance.submit();

    expect(emitted).toEqual({ DOB: '1961-11-19', Id: 'u1', Active: 'false', Age: '64' });
  });

  it('refuses a model of a newer contract version instead of guessing', () => {
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, { ...typedModel(), contractVersion: 2 });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('older version');
  });

  function pageModel(): EntityFormModel {
    return {
      contractVersion: 1,
      schema: {
        schemaIri: 'urn:page',
        fields: [
          { name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 },
          { name: 'Parent', type: 'ref:urn:page', isRequired: false, label: 'Parent', order: 2, refSchema: 'urn:page' },
          { name: 'Content', type: 'Markdown', isRequired: false, label: 'Content', order: 3 },
        ],
      },
      entity: { entityId: 'p1', values: { Title: 'Angular', Parent: 'p0', Content: '# Hello\n\nsome **bold** text' }, display: { Parent: 'Article' } },
      lookups: { Parent: '/api/lookups?schema=urn%3Apage&exclude=p1' },
    };
  }

  it('fills a pointer field select from the server lookup link and selects the current value', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, pageModel());
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.includes('/api/lookups') && r.url.includes('exclude=p1'))
      .flush([{ id: 'p0', text: 'Article' }, { id: 'p2', text: 'Other' }]);
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select[aria-label="Parent"]') as HTMLSelectElement;

    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(['None', 'Article', 'Other']);
    expect(select.value).toBe('p0');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Currently: Article');
  });

  it('edits Markdown in a text area and previews it rendered, without sending the preview anywhere', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideMarkdown()] });
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, pageModel());
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.includes('/api/lookups')).flush([]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('textarea[aria-label="Content"]')).not.toBeNull();
    (Array.from(root.querySelectorAll('.entity-form__rich-head button')).find((b) => b.textContent?.includes('Preview')) as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.entity-form__preview h1')?.textContent).toBe('Hello');
    expect(root.querySelector('.entity-form__preview strong')?.textContent).toBe('bold');
    expect(root.querySelector('textarea')).toBeNull();
  });

  it('uploads a chosen image and inserts the Markdown that shows it at the cursor, then shows a refusal in the server own words', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideMarkdown()] });
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, pageModel());
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.includes('/api/lookups')).flush([]);
    const root = fixture.nativeElement as HTMLElement;
    const area = root.querySelector('textarea[aria-label="Content"]') as HTMLTextAreaElement;
    area.setSelectionRange(8, 8);   // after "# Hello\n"
    const input = root.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array([0x89, 0x50])], 'My Photo.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    const upload = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/media'));
    expect(upload.request.body instanceof FormData).toBe(true);
    upload.flush({ id: 'm1', name: 'my-photo.png', url: 'https://api.test/api/media/m1/my-photo.png', markdown: '![my-photo](https://api.test/api/media/m1/my-photo.png)' });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls['Content'].value).toBe('# Hello\n![my-photo](https://api.test/api/media/m1/my-photo.png)\n\nsome **bold** text');

    Object.defineProperty(input, 'files', { value: [new File(['<html>'], 'evil.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    http.expectOne((r) => r.url.endsWith('/api/media')).flush({ title: 'Only PNG, JPEG, GIF and WebP images are accepted.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(root.querySelector('.entity-form__error')?.textContent).toContain('Only PNG, JPEG, GIF and WebP');
    expect(fixture.componentInstance.form.controls['Content'].value).toContain('my-photo');   // the refused file changed nothing
  });

  it('draws a multi-valued pointer as checkboxes over the lookup and posts the chosen ids as a comma-separated list', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(EntityForm);
    applyModel(fixture, {
      contractVersion: 1,
      schema: {
        schemaIri: 'urn:post',
        fields: [
          { name: 'Title', type: 'String', isRequired: true, label: 'Title', order: 1 },
          { name: 'Categories', type: 'refs:urn:category', isRequired: false, label: 'Categories', order: 2, refSchema: 'urn:category' },
        ],
      },
      entity: { entityId: 'p1', values: { Title: 'Post', Categories: 'c1' }, display: { Categories: 'Angular' } },
      lookups: { Categories: '/api/lookups?schema=urn%3Acategory' },
    });
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.includes('/api/lookups'))
      .flush([{ id: 'c1', text: 'Angular' }, { id: 'c2', text: 'CLI' }]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const boxes = Array.from(root.querySelectorAll('.entity-form__choices input')) as HTMLInputElement[];
    let emitted: Record<string, string | null> | undefined;
    fixture.componentInstance.save.subscribe((values) => (emitted = values));

    expect(boxes.map((b) => b.checked)).toEqual([true, false]);
    boxes[1].click();
    fixture.componentInstance.submit();

    expect(emitted?.['Categories']).toBe('c1,c2');
  });

  describe('choices and remembered defaults', () => {
    const iri = 'https://schema.global-webnet.com/collaboration/CollaborationItem';

    function itemModel(entityId: string, values: Record<string, string> = {}): EntityFormModel {
      return {
        schema: {
          schemaIri: iri,
          fields: [
            { name: 'Kind', type: 'String', isRequired: false, choices: ['Developer', 'Research'], remember: true },
            { name: 'Branch', type: 'String', isRequired: false, remember: true },
          ],
        },
        entity: { entityId, values },
      };
    }

    beforeEach(() => {
      const store = new Map<string, string>();
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        clear: () => store.clear(),
      });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('draws a dropdown for a field with choices and starts a new entity on the first choice', () => {
      const fixture = TestBed.createComponent(EntityForm);
      applyModel(fixture, itemModel(''));
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('select option').length).toBe(2);
      expect(fixture.componentInstance.form.value['Kind']).toBe('Developer');
    });

    it('starts a new entity from the values last saved, and remembers a save', () => {
      localStorage.setItem(`entity.last.${iri}.Kind`, 'Research');
      localStorage.setItem(`entity.last.${iri}.Branch`, 'claude-x');
      const fixture = TestBed.createComponent(EntityForm);
      applyModel(fixture, itemModel(''));
      fixture.detectChanges();

      expect(fixture.componentInstance.form.value).toEqual({ Kind: 'Research', Branch: 'claude-x' });

      fixture.componentInstance.form.controls['Branch'].setValue('claude-y');
      fixture.componentInstance.submit();

      expect(localStorage.getItem(`entity.last.${iri}.Branch`)).toBe('claude-y');
    });

    it('lists a choice that is switched off but cannot be picked, and never starts on it', () => {
      localStorage.setItem(`entity.last.${iri}.Kind`, 'Research');
      const model = itemModel('');
      model.schema.fields[0].disabledChoices = ['Research'];
      const fixture = TestBed.createComponent(EntityForm);
      applyModel(fixture, model);
      fixture.detectChanges();

      const options = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('select option')) as HTMLOptionElement[];
      expect(options.find((o) => o.value === 'Research')?.disabled).toBe(true);
      expect(options.find((o) => o.value === 'Developer')?.disabled).toBe(false);
      expect(fixture.componentInstance.form.value['Kind']).toBe('Developer');
    });

    it('leaves an existing entity alone and does not overwrite the remembered values from it', () => {
      localStorage.setItem(`entity.last.${iri}.Branch`, 'claude-x');
      const fixture = TestBed.createComponent(EntityForm);
      applyModel(fixture, itemModel('item-1', { Kind: 'Research', Branch: '' }));
      fixture.detectChanges();
      fixture.componentInstance.submit();

      expect(fixture.componentInstance.form.value['Branch']).toBe('');
      expect(localStorage.getItem(`entity.last.${iri}.Branch`)).toBe('claude-x');
    });
  });
});
