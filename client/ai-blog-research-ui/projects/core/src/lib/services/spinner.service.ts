import { Injectable, computed, signal } from '@angular/core';

/**
 * The one global "busy" indicator: the page shows the turning gears while anything has asked for them. Calls are counted, so
 * two overlapping jobs keep it on until the last one stops, and a stray extra stop can never leave it negative.
 */
@Injectable({ providedIn: 'root' })
export class SpinnerService {
  private readonly count = signal(0);

  /** True while at least one job is running. */
  readonly active = computed(() => this.count() > 0);

  start(): void {
    this.count.update((n) => n + 1);
  }

  stop(): void {
    this.count.update((n) => Math.max(0, n - 1));
  }
}
