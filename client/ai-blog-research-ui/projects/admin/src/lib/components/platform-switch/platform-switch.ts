import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { API_BASE_URL, describeApiError } from '@adventures/core';

/** The switch of one person and whether the signed-in person may change it (the server decides; only a platform administrator may). */
interface PlatformState {
  isPlatformAdministrator: boolean;
  canChange: boolean;
}

/**
 * The Platform administrator switch on a person's screen. It belongs to the person, not to any tenant or role: a platform administrator manages what roles
 * allow and which hosts reach which tenant, in every tenant. Everyone who can open the person sees the state; only a platform administrator can change it, and the
 * server refuses to switch off the last one (the refusal is shown in its words and the switch snaps back).
 */
@Component({
  selector: 'adv-platform-switch',
  imports: [MatSlideToggleModule],
  template: `
    <section class="platform-switch">
      <h3>Platform</h3>
      @for (message of errors(); track message) {
        <p class="platform-switch__error" role="alert">{{ message }}</p>
      }
      @if (state(); as current) {
        <mat-slide-toggle [checked]="current.isPlatformAdministrator" [disabled]="!current.canChange || saving()" (change)="change($event.checked)">
          Platform administrator
        </mat-slide-toggle>
        <p class="platform-switch__hint">
          Manages what the roles allow and which host names reach which tenant, in every tenant. It is not a role and does not give rights inside a tenant.
          @if (!current.canChange) {
            Only a platform administrator can change it.
          }
        </p>
      }
    </section>
  `,
  styles: `
    .platform-switch__hint {
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .platform-switch__error {
      color: var(--mat-sys-error);
    }
  `,
})
export class PlatformSwitch implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  readonly userId = input.required<string>();

  protected readonly state = signal<PlatformState | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.http.get<PlatformState>(this.url()).subscribe({
      next: (state) => this.state.set(state),
      error: (error) => this.errors.set(describeApiError(error, 'Could not read the platform switch.')),
    });
  }

  protected change(on: boolean): void {
    this.saving.set(true);
    this.errors.set([]);
    this.http.put(this.url(), { on }).subscribe({
      next: () => {
        this.saving.set(false);
        this.state.update((state) => (state ? { ...state, isPlatformAdministrator: on } : state));
      },
      error: (error) => {
        this.saving.set(false);
        this.errors.set(describeApiError(error, 'The platform switch was not changed.'));
        // snap the toggle back to what the server holds
        const held = this.state();
        this.state.set(held ? { ...held } : held);
      },
    });
  }

  private url(): string {
    return `${this.apiUrl}/api/users/${encodeURIComponent(this.userId())}/platform`;
  }
}
