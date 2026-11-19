import { AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { describeApiError, MediaService } from '@adventures/core';

/** Only these kinds of address may become a link: the web, mail, and a path on this site. Anything else (javascript:, data:, ...) is refused. */
const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

/**
 * A visual (WYSIWYG) editor for Markdown fields: the person formats text on the page, and what is stored stays Markdown, so the same
 * text still reads well to an AI author, in a diff, and through the existing sanitised reader. Nothing is rewritten just because the editor was
 * opened: the Markdown changes only when the person changes something. Constructs the editor does not draw (raw HTML, footnotes) stay safe
 * in the Markdown view, which is always one click away. Pictures are uploaded through the media route, as in the Markdown view.
 */
@Component({
  selector: 'adv-visual-editor',
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './visual-editor.html',
  styleUrl: './visual-editor.scss',
})
export class VisualEditor implements AfterViewInit, OnDestroy {
  private readonly media = inject(MediaService);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');

  /** The Markdown to edit. A new value from outside (a reset, a switch back from the Markdown view) replaces what is shown. */
  readonly markdown = input<string>('');
  readonly label = input<string>('Content');

  /** The Markdown after the person changed something. */
  readonly markdownChange = output<string>();

  protected readonly uploading = signal(false);
  protected readonly errors = signal<string[]>([]);
  /** Bumped on every editor change so the toolbar can show which buttons are active. */
  protected readonly tick = signal(0);

  protected editor!: Editor;

  constructor() {
    effect(() => {
      const incoming = this.markdown();
      if (this.editor && !this.editor.isDestroyed && incoming !== this.editor.getMarkdown()) {
        this.editor.commands.setContent(incoming, { emitUpdate: false, contentType: 'markdown' });
      }
    });
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.surface().nativeElement,
      extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false } }), Image, TableKit, Markdown],
      content: this.markdown(),
      contentType: 'markdown',
      editorProps: { attributes: { 'aria-label': this.label(), role: 'textbox', 'aria-multiline': 'true' } },
      onUpdate: ({ editor }) => {
        this.tick.update((n) => n + 1);
        this.markdownChange.emit(editor.getMarkdown());
      },
      onSelectionUpdate: () => this.tick.update((n) => n + 1),
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  protected active(name: string, attributes?: Record<string, unknown>): boolean {
    this.tick();
    return !!this.editor && this.editor.isActive(name, attributes);
  }

  protected bold(): void {
    this.editor.chain().focus().toggleBold().run();
  }

  protected italic(): void {
    this.editor.chain().focus().toggleItalic().run();
  }

  protected strike(): void {
    this.editor.chain().focus().toggleStrike().run();
  }

  protected code(): void {
    this.editor.chain().focus().toggleCode().run();
  }

  protected heading(level: 2 | 3): void {
    this.editor.chain().focus().toggleHeading({ level }).run();
  }

  protected bullets(): void {
    this.editor.chain().focus().toggleBulletList().run();
  }

  protected numbers(): void {
    this.editor.chain().focus().toggleOrderedList().run();
  }

  protected quote(): void {
    this.editor.chain().focus().toggleBlockquote().run();
  }

  protected codeBlock(): void {
    this.editor.chain().focus().toggleCodeBlock().run();
  }

  protected rule(): void {
    this.editor.chain().focus().setHorizontalRule().run();
  }

  /** Asks for an address and links the selected text to it; an empty answer removes the link. */
  protected askLink(): void {
    const current = (this.editor.getAttributes('link')['href'] as string | undefined) ?? 'https://';
    const answer = typeof window !== 'undefined' ? window.prompt('Link address', current) : null;
    if (answer !== null) {
      this.link(answer.trim() === '' ? null : answer.trim());
    }
  }

  /** Links the selection to the address, or removes the link for null. An address that is not safe to follow is refused. */
  protected link(address: string | null): void {
    if (address === null) {
      this.editor.chain().focus().unsetLink().run();
      return;
    }

    if (!SAFE_LINK.test(address)) {
      this.errors.set(['Links must start with https://, http://, mailto: or /.']);
      return;
    }

    this.errors.set([]);
    this.editor.chain().focus().extendMarkRange('link').setLink({ href: address }).run();
  }

  protected insertImage(url: string, alt: string): void {
    this.editor.chain().focus().setImage({ src: url, alt }).run();
  }

  /** Uploads the chosen picture and places it at the cursor. The server decides what is a picture; a refusal is shown in its own words. */
  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.errors.set([]);
    this.media.upload(file).subscribe({
      next: (item) => {
        this.insertImage(item.url, file.name.replace(/\.[^.]+$/, ''));
        this.uploading.set(false);
      },
      error: (error) => {
        this.errors.set(describeApiError(error, 'Could not upload that image.'));
        this.uploading.set(false);
      },
    });
  }
}
