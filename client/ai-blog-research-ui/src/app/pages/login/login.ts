// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Set when the person was sent here because their sign-in ran out. */
  protected readonly expired = this.route.snapshot.queryParamMap.get('expired') === '1';

  /** Where to go after signing in: the page they were on, only if it is a path inside this app. */
  private readonly returnUrl = (() => {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : null;
  })();

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    const { userName, password } = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(userName, password).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        // A seeded or reset account is sent straight to where the password is changed; the page it came from is kept for afterwards.
        if (this.authService.mustChangePassword()) {
          if (this.returnUrl) {
            this.authService.rememberReturnUrl(this.returnUrl);
          }
          this.router.navigateByUrl('/profile');
        } else {
          this.router.navigateByUrl(this.returnUrl ?? '/');
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Incorrect username or password.');
      },
    });
  }
}
