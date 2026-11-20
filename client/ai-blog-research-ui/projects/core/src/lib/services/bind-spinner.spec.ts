import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bindSpinner } from './bind-spinner';
import { SpinnerService } from './spinner.service';

@Component({ template: '' })
class Page {
  readonly loading = signal(true);
  private readonly gears = bindSpinner(this.loading);
}

describe('bindSpinner', () => {
  it('runs the gears while the page is loading and stops them when it has loaded', () => {
    const fixture = TestBed.createComponent(Page);
    const spinner = TestBed.inject(SpinnerService);
    fixture.detectChanges();
    expect(spinner.active()).toBe(true);

    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();
    expect(spinner.active()).toBe(false);

    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect(spinner.active()).toBe(true);
  });

  it('stops the gears when the page is left while it is still loading', () => {
    const fixture = TestBed.createComponent(Page);
    const spinner = TestBed.inject(SpinnerService);
    fixture.detectChanges();
    expect(spinner.active()).toBe(true);

    fixture.destroy();
    expect(spinner.active()).toBe(false);
  });
});
