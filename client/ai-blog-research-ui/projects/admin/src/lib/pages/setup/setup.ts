import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelKey, LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';
import { SetupService, SetupSite } from '@adventures/core';

type Step = 'checking' | 'notNeeded' | 'signIn' | 'choose' | 'done';

/**
 * The page an address with no site shows: a platform administrator of an existing site signs in with that site's own sign-in, then attaches this address to a site (it becomes an
 * alias) or starts a new site here (with its own Admin, default password changed at the first sign-in).
 */
@Component({
  selector: 'adv-setup',
  imports: [PageHeader, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './setup.html',
  styleUrl: './setup.scss',
})
export class Setup implements OnInit {
  private readonly service = inject(SetupService);

  protected readonly step = signal<Step>('checking');
  protected readonly host = signal('');
  protected readonly sites = signal<SetupSite[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<LabelKey | null>(null);
  protected readonly result = signal<'attached' | 'created' | null>(null);
  private token = '';

  protected readonly signInForm = new FormGroup({
    site: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly attachForm = new FormGroup({ tenantId: new FormControl('', { nonNullable: true, validators: [Validators.required] }) });
  protected readonly newForm = new FormGroup({ name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }) });

  ngOnInit(): void {
    this.service.status().subscribe({
      next: (status) => {
        this.host.set(status.host);
        this.step.set(status.needsSetup ? 'signIn' : 'notNeeded');
      },
      error: () => this.step.set('notNeeded'),
    });
  }

  signIn(): void {
    if (this.signInForm.invalid || this.busy()) {
      return;
    }
    const { site, userName, password } = this.signInForm.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.service.signIn(site, userName, password).subscribe({
      next: (issued) => {
        this.token = issued.accessToken;
        this.signInForm.reset();   // the password is not kept
        this.service.sites(this.token).subscribe({
          next: (sites) => {
            this.sites.set(sites);
            this.busy.set(false);
            this.step.set('choose');
          },
          error: () => this.fail('setupFailed'),
        });
      },
      error: (problem) => this.fail(problem?.status === 409 ? 'setupChangePasswordFirst' : 'setupBadSignIn'),
    });
  }

  attach(): void {
    if (this.attachForm.invalid || this.busy()) {
      return;
    }
    this.run(this.service.attach(this.token, this.attachForm.getRawValue().tenantId), 'attached');
  }

  startNew(): void {
    if (this.newForm.invalid || this.busy()) {
      return;
    }
    this.run(this.service.newSite(this.token, this.newForm.getRawValue().name.trim()), 'created');
  }

  private run(call: ReturnType<SetupService['attach']>, outcome: 'attached' | 'created'): void {
    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => {
        this.token = '';
        this.busy.set(false);
        this.result.set(outcome);
        this.step.set('done');
      },
      error: () => this.fail('setupFailed'),
    });
  }

  private fail(key: LabelKey): void {
    this.busy.set(false);
    this.error.set(key);
  }
}
