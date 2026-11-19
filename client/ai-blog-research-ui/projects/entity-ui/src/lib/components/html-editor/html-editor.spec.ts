import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HtmlEditor, TINYMCE_LOADER, TinyApi } from './html-editor';

/** A stand-in for TinyMCE: records how it was set up and lets a test type into it. TinyMCE itself needs a real browser. */
class FakeEditor {
  content = '';
  handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  removed = false;

  on(names: string, handler: (...args: unknown[]) => void): void {
    for (const name of names.split(' ')) {
      (this.handlers[name] ??= []).push(handler);
    }
  }

  getContent(): string {
    return this.content;
  }

  setContent(html: string): void {
    this.content = html;
  }

  remove(): void {
    this.removed = true;
  }

  type(html: string): void {
    this.content = html;
    for (const handler of this.handlers['input'] ?? []) {
      handler();
    }
  }
}

describe('HtmlEditor', () => {
  let editor: FakeEditor;
  let options: Record<string, unknown>;

  beforeEach(() => {
    editor = new FakeEditor();
    const api: TinyApi = {
      init: (config) => {
        options = config as Record<string, unknown>;
        editor.content = (config['target'] as HTMLTextAreaElement).value;
        (config['setup'] as ((e: unknown) => void) | undefined)?.(editor);
        return Promise.resolve([editor]);
      },
    };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: TINYMCE_LOADER, useValue: () => Promise.resolve(api) }],
    });
  });

  async function open(html: string) {
    const fixture = TestBed.createComponent(HtmlEditor);
    fixture.componentRef.setInput('html', html);
    const changes: string[] = [];
    fixture.componentInstance.htmlChange.subscribe((value) => changes.push(value));
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, changes };
  }

  it('starts the editor on the text, with the files served by this site and a Word-like toolbar', async () => {
    await open('<p>Hello</p>');

    expect((options['target'] as HTMLTextAreaElement).value).toBe('<p>Hello</p>');
    expect(options['base_url']).toBe('/tinymce');
    expect(options['suffix']).toBe('.min');
    const toolbar = String(options['toolbar']);
    for (const wanted of ['bold', 'italic', 'underline', 'alignleft', 'aligncenter', 'bullist', 'numlist', 'forecolor', 'backcolor', 'link', 'image', 'table']) {
      expect(toolbar).toContain(wanted);
    }
  });

  it('does not report a change just because it was opened', async () => {
    const { changes } = await open('<p>Hello</p>');

    expect(changes).toEqual([]);
  });

  it('reports the HTML after the person types', async () => {
    const { changes } = await open('<p>Hello</p>');

    editor.type('<p>Hello there</p>');

    expect(changes).toEqual(['<p>Hello there</p>']);
  });

  it('reports a change only when the text really changed', async () => {
    const { changes } = await open('<p>Hello</p>');

    editor.type('<p>Hello</p>');

    expect(changes).toEqual([]);
  });

  it('takes new text from outside', async () => {
    const { fixture } = await open('<p>one</p>');

    fixture.componentRef.setInput('html', '<p>two</p>');
    fixture.detectChanges();

    expect(editor.content).toBe('<p>two</p>');
  });

  it('uploads a picture through the media route and gives the editor its address', async () => {
    await open('');
    const upload = options['images_upload_handler'] as (blob: { blob(): Blob; filename(): string }) => Promise<string>;

    const pending = upload({ blob: () => new Blob(['x'], { type: 'image/png' }), filename: () => 'chart.png' });
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/media'))
      .flush({ id: 'm1', name: 'chart.png', url: 'https://api.test/api/media/m1/chart.png', markdown: '' });

    expect(await pending).toBe('https://api.test/api/media/m1/chart.png');
  });

  it('keeps addresses as the person typed them, and does not let a picture arrive inline', async () => {
    await open('');

    expect(options['relative_urls']).toBe(false);
    expect(options['convert_urls']).toBe(false);
    expect(options['paste_data_images']).toBe(false);
  });

  it('lets go of the editor when it is removed', async () => {
    const { fixture } = await open('');

    fixture.destroy();

    expect(editor.removed).toBe(true);
  });
});
