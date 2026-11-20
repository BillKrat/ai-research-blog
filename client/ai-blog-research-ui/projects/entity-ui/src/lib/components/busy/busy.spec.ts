import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpinnerService } from '@adventures/core';
import { Busy } from './busy';

@Component({ imports: [Busy], template: `@if (waiting()) { <adv-busy /> }` })
class Host {
  readonly waiting = signal(true);
}

describe('Busy', () => {
  it('runs the gears for as long as it is on the page', () => {
    const fixture = TestBed.createComponent(Host);
    const spinner = TestBed.inject(SpinnerService);
    fixture.detectChanges();
    expect(spinner.active()).toBe(true);

    fixture.componentInstance.waiting.set(false);
    fixture.detectChanges();
    expect(spinner.active()).toBe(false);
  });
});
