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
});
