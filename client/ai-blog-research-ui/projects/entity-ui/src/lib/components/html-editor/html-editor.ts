import { AfterViewInit, Component, ElementRef, InjectionToken, OnDestroy, effect, inject, input, output, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MediaService } from '@adventures/core';

/** The part of TinyMCE this component uses. */
export interface TinyApi {
  init(config: Record<string, unknown>): Promise<unknown[]>;
}

/** The part of a TinyMCE editor this component uses. */
interface TinyEditor {
  on(names: string, handler: (...args: unknown[]) => void): void;
  getContent(): string;
  setContent(html: string): void;
  remove(): void;
}

/**
 * How TinyMCE is brought in: its own script, served by this site from /tinymce (copied from the tinymce npm package, version 6.x, MIT licensed, the
 * last open-source line), loaded only when an HTML field is first opened. It is not part of the app bundle. Tests replace this to avoid a real browser editor.
 */
export const TINYMCE_LOADER = new InjectionToken<() => Promise<TinyApi>>('TINYMCE_LOADER', {
  providedIn: 'root',
  factory: () => {
    let loading: Promise<TinyApi> | undefined;
    return () =>
      (loading ??= new Promise<TinyApi>((resolve, reject) => {
        const present = (globalThis as { tinymce?: TinyApi }).tinymce;
        if (present) {
          resolve(present);
          return;
        }

        const script = document.createElement('script');
        script.src = '/tinymce/tinymce.min.js';
        script.onload = () => resolve((globalThis as { tinymce?: TinyApi }).tinymce as TinyApi);
        script.onerror = () => {
          loading = undefined;
          reject(new Error('The visual editor could not be loaded.'));
        };
        document.head.appendChild(script);
      }));
  },
});

/**
 * The Word-like editor for HTML content (TinyMCE 6): formats, bold, italic, underline, alignment, lists, colours, links, pictures and tables, the same kind
 * of editor BlogEngine used. It reports the HTML only when the person changes something. The server makes the HTML safe when it is saved and again when it is
 * served, so nothing here is trusted. Pictures go to the media route, which checks the file; nothing arrives inline.
 */
@Component({
  selector: 'adv-html-editor',
  template: `<textarea #field class="html-editor" [attr.aria-label]="label()"></textarea>`,
  styleUrl: './html-editor.scss',
})
export class HtmlEditor implements AfterViewInit, OnDestroy {
  private readonly load = inject(TINYMCE_LOADER);
  private readonly media = inject(MediaService);
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  /** The HTML to edit. New text from outside (a reset) replaces what is shown. */
  readonly html = input<string>('');
  readonly label = input<string>('Content');

  /** The HTML after the person changed something. */
  readonly htmlChange = output<string>();

  private editor?: TinyEditor;
  private last = '';
  private destroyed = false;

  constructor() {
    effect(() => {
      const incoming = this.html();
      if (this.editor && incoming !== this.last) {
        this.last = incoming;
        this.editor.setContent(incoming);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const area = this.field().nativeElement;
    area.value = this.html();
    this.last = this.html();
    const tiny = await this.load();
    if (this.destroyed) {
      return;
    }

    const dark = typeof document !== 'undefined' && document.body.style.colorScheme !== 'light';
    const [editor] = (await tiny.init({
      target: area,
      base_url: '/tinymce',
      suffix: '.min',
      promotion: false,
      branding: false,
      menubar: 'edit insert format table',
      min_height: 420,
      skin: dark ? 'oxide-dark' : 'oxide',
      content_css: dark ? 'dark' : 'default',
      plugins: 'lists link image table charmap hr searchreplace wordcount autolink fullscreen code',
      toolbar:
        'undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | forecolor backcolor | link image table | removeformat | code fullscreen',
      // addresses stay as typed; a picture is uploaded to the media route, never embedded in the text
      relative_urls: false,
      convert_urls: false,
      paste_data_images: false,
      automatic_uploads: true,
      images_upload_handler: (blob: { blob(): Blob; filename(): string }) =>
        firstValueFrom(this.media.upload(new File([blob.blob()], blob.filename(), { type: blob.blob().type }))).then((item) => item.url),
      setup: (instance: TinyEditor) => {
        instance.on('input change undo redo', () => this.changed(instance));
      },
    })) as TinyEditor[];
    this.editor = editor;
    if (this.destroyed) {
      editor.remove();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.editor?.remove();
  }

  private changed(editor: TinyEditor): void {
    const html = editor.getContent();
    if (html !== this.last) {
      this.last = html;
      this.htmlChange.emit(html);
    }
  }
}
