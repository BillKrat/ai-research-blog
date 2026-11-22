import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { describeApiError } from '@adventures/core';
import { LABELS, LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';
import { LanguageSummary, LanguagesAdminService } from '../../services/languages-admin.service';

/**
 * The language files of the site, one table of texts per language code (the site language is chosen under Settings). Open a language to change its
 * texts, or start a new one from the English texts, which lists every key the screens use. A key a file leaves out shows in English, so a file can be
 * finished a little at a time. The server checks every file before it is kept.
 */
@Component({
  selector: 'adv-admin-languages',
  imports: [PageHeader, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-languages.html',
  styleUrl: './admin-languages.scss',
})
export class AdminLanguages implements OnInit {
  private readonly api = inject(LanguagesAdminService);

  protected readonly languages = signal<LanguageSummary[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly saved = signal(false);
  protected readonly code = signal('');
  protected readonly table = signal('');
  /** True while the code in the editor is a stored language (the Remove button shows). */
  protected readonly isStored = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected open(language: string): void {
    this.errors.set([]);
    this.saved.set(false);
    this.api.read(language).subscribe({
      next: (found) => {
        this.code.set(found.language);
        this.table.set(JSON.stringify(found.labels, null, 2));
        this.isStored.set(true);
      },
      error: (error) => this.errors.set(describeApiError(error, "Couldn't open the language.")),
    });
  }

  /** Every key with its English text: the screens' own texts and the ones the server produces. A catalog that cannot be read leaves the screens' keys. */
  protected useEnglish(): void {
    this.errors.set([]);
    this.saved.set(false);
    this.api.catalog().subscribe({
      next: (server) => this.table.set(JSON.stringify({ ...LABELS, ...server }, null, 2)),
      error: () => this.table.set(JSON.stringify(LABELS, null, 2)),
    });
  }

  protected save(): void {
    this.saved.set(false);
    const labels = this.parse();
    if (labels === null) {
      return;
    }

    const language = this.code().trim().toLowerCase();
    this.errors.set([]);
    this.api.save(language, labels).subscribe({
      next: () => {
        this.saved.set(true);
        this.isStored.set(true);
        this.reload();
      },
      error: (error) => this.errors.set(describeApiError(error, "Couldn't save the language.")),
    });
  }

  protected remove(): void {
    const language = this.code().trim().toLowerCase();
    this.errors.set([]);
    this.api.remove(language).subscribe({
      next: () => {
        this.code.set('');
        this.table.set('');
        this.isStored.set(false);
        this.reload();
      },
      error: (error) => this.errors.set(describeApiError(error, "Couldn't remove the language.")),
    });
  }

  /** The table as an object of texts, or null (with the reason shown) when the editor does not hold one. */
  private parse(): Record<string, string> | null {
    try {
      const value: unknown = JSON.parse(this.table());
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((text) => typeof text === 'string')) {
        return value as Record<string, string>;
      }
    } catch {
      // fall through to the message
    }

    this.errors.set(['The table must be a JSON object that maps each key to its text, for example {"save": "Speichern"}.']);
    return null;
  }

  private reload(): void {
    this.api.list().subscribe({
      next: (list) => this.languages.set(list),
      error: (error) => this.errors.set(describeApiError(error, "Couldn't load the languages.")),
    });
  }
}
