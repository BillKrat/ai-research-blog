// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { describeApiError } from '../../models/api-error';
import { AuthService } from '../../services/auth.service';
import { EntityApiService } from '../../services/entity-api.service';

/**
 * Add, Edit and Delete for the post or page a signed-in user is reading. Anonymous visitors see nothing. The public API carries
 * no ids, so Edit and Delete ask the admin API for the id of this slug when they are used; the server still refuses anyone who
 * is not an administrator.
 */
@Component({
  selector: 'app-content-tools',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './content-tools.html',
  styleUrl: './content-tools.scss',
})
export class ContentTools {
  private readonly api = inject(EntityApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  /** Which collection the content belongs to: the admin segment and the noun on the buttons. */
  readonly kind = input.required<'posts' | 'pages'>();
  readonly slug = input.required<string>();

  /** Where to go after a delete (the content it showed no longer exists). */
  readonly deleted = output<void>();

  protected get noun(): string {
    return this.kind() === 'posts' ? 'post' : 'page';
  }

  protected add(): void {
    void this.router.navigate(['/admin', this.kind(), 'new']);
  }

  protected edit(): void {
    this.resolve((id) => void this.router.navigate(['/admin', this.kind(), id]));
  }

  protected remove(): void {
    if (!window.confirm(`Delete this ${this.noun}? It will no longer be shown.`)) {
      return;
    }

    this.resolve((id) =>
      this.api.remove(`/api/${this.kind()}/${encodeURIComponent(id)}`).subscribe({
        next: () => {
          this.deleted.emit();
          void this.router.navigate([this.kind() === 'posts' ? '/posts' : '/']);
        },
        error: (error) => window.alert(describeApiError(error, 'Could not delete.').join('\n')),
      }),
    );
  }

  private resolve(then: (id: string) => void): void {
    this.api.idBySlug(`/api/${this.kind()}`, this.slug()).subscribe({
      next: (found) => then(found.id),
      error: (error) => window.alert(describeApiError(error, `Could not find this ${this.noun} in the admin.`).join('\n')),
    });
  }
}
