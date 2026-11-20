import { Component, OnDestroy, inject } from '@angular/core';
import { SpinnerService } from '@adventures/core';

/** Put it where a "Loading..." line used to be: the global gears run while it is on the page. Draws nothing itself. */
@Component({ selector: 'adv-busy', template: '' })
export class Busy implements OnDestroy {
  private readonly spinner = inject(SpinnerService);

  constructor() {
    this.spinner.start();
  }

  ngOnDestroy(): void {
    this.spinner.stop();
  }
}
