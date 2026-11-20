import { TestBed } from '@angular/core/testing';
import { SpinnerService } from './spinner.service';

describe('SpinnerService', () => {
  it('is idle until something starts', () => {
    expect(TestBed.inject(SpinnerService).active()).toBe(false);
  });

  it('is active from the first start until the last stop (overlapping work keeps it on)', () => {
    const spinner = TestBed.inject(SpinnerService);
    spinner.start();
    spinner.start();
    spinner.stop();
    expect(spinner.active()).toBe(true);
    spinner.stop();
    expect(spinner.active()).toBe(false);
  });

  it('never goes below idle when stopped too often', () => {
    const spinner = TestBed.inject(SpinnerService);
    spinner.stop();
    spinner.start();
    expect(spinner.active()).toBe(true);
    spinner.stop();
    expect(spinner.active()).toBe(false);
  });
});
