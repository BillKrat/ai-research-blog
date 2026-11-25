import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';
import { ContactInfo, PublicContentService } from '../../../services/public-content.service';

/**
 * The Contact plug-in's page: a form that sends a message to the owner by e-mail. When the owner has the plug-in off, the page says it is not available. The form
 * carries a hidden field only a robot fills in (the server drops those quietly); the recipient address is never shown.
 */
@Component({
  selector: 'adv-contact-page',
  imports: [MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.scss',
})
export class ContactPage implements OnInit {
  private readonly content = inject(PublicContentService);

  protected readonly info = signal<ContactInfo | null>(null);
  protected readonly notice = signal('');
  protected readonly problem = signal('');
  protected readonly sending = signal(false);

  ngOnInit(): void {
    this.content.contact().subscribe({
      next: (info) => this.info.set(info),
      error: () => this.info.set({ enabled: false, intro: '' }),
    });
  }

  protected send(form: HTMLFormElement, name: string, email: string, message: string, website: string): void {
    this.notice.set('');
    this.problem.set('');
    if (name.trim() === '' || email.trim() === '' || message.trim() === '') {
      this.problem.set('Please give your name, an e-mail address and a message.');
      return;
    }

    this.sending.set(true);
    this.content.sendContact({ name: name.trim(), email: email.trim(), message: message.trim(), website }).subscribe({
      next: () => {
        this.sending.set(false);
        this.notice.set('Thank you. Your message has been sent.');
        form.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.sending.set(false);
        this.problem.set(this.messageOf(error));
      },
    });
  }

  private messageOf(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'You are sending messages too quickly. Please wait a minute and try again.';
    }

    if (error.status === 409 && typeof error.error === 'string' && error.error !== '') {
      return error.error;
    }

    return 'Your message could not be sent. Please try again.';
  }
}
