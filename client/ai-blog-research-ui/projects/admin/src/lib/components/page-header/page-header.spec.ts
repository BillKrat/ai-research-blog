import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader],
  template: `<adv-page-header title="Categories"><button type="button">Add</button></adv-page-header>`,
})
class Host {}

describe('PageHeader', () => {
  it('draws the title as an H2 with the projected actions on the same line, right-justified', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('header.page-header > h2')?.textContent).toBe('Categories');
    expect(root.querySelector('.page-header__actions button')?.textContent).toBe('Add');
    expect(getComputedStyle(root.querySelector('.page-header__actions') as HTMLElement).justifyContent).toMatch(/end/);
  });
});
