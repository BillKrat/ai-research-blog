import { DestroyRef, Signal, effect, inject } from '@angular/core';
import { SpinnerService } from './spinner.service';

/**
 * Ties a page's "loading" flag to the global gears: they run while the flag is true and stop when it is false or the page goes
 * away. Call it from a field initializer (it needs the injection context), after the flag is declared:
 * <code>private readonly gears = bindSpinner(this.isLoading);</code>. It replaces the old "Loading..." lines.
 */
export function bindSpinner(loading: Signal<boolean>): void {
  const spinner = inject(SpinnerService);
  let on = false;
  const set = (value: boolean): void => {
    if (value && !on) {
      on = true;
      spinner.start();
    } else if (!value && on) {
      on = false;
      spinner.stop();
    }
  };

  effect(() => set(loading()));
  inject(DestroyRef).onDestroy(() => set(false));
}
