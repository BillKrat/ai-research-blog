import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VisualEditor } from './visual-editor';

type Inner = {
  editor: { commands: { selectAll(): boolean; focus(position?: string): boolean }; getMarkdown(): string; isDestroyed: boolean };
  bold(): void;
  heading(level: 2 | 3): void;
  bullets(): void;
  link(address: string | null): void;
  insertImage(url: string, alt: string): void;
};

describe('VisualEditor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  function open(markdown: string) {
    const fixture = TestBed.createComponent(VisualEditor);
    fixture.componentRef.setInput('markdown', markdown);
    const changes: string[] = [];
    fixture.componentInstance.markdownChange.subscribe((value) => changes.push(value));
    fixture.detectChanges();
    return { fixture, changes, inner: fixture.componentInstance as unknown as Inner, root: fixture.nativeElement as HTMLElement };
  }

  it('shows the Markdown as formatted text the person can edit directly', () => {
    const { root } = open('## Steps\n\nDo **this** first.\n\n- one\n- two\n');

    const surface = root.querySelector('.ProseMirror') as HTMLElement;
    expect(surface.getAttribute('contenteditable')).toBe('true');
    expect(surface.querySelector('h2')?.textContent).toBe('Steps');
    expect(surface.querySelector('strong')?.textContent).toBe('this');
    expect(surface.querySelectorAll('li').length).toBe(2);
  });

  it('does not rewrite the text just because it was opened: nothing is emitted until the person changes something', () => {
    const { changes } = open('A table:\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');

    expect(changes).toEqual([]);
  });

  it('turns what the person formats back into Markdown', () => {
    const { inner, changes } = open('plain words');

    inner.editor.commands.selectAll();
    inner.bold();

    expect(changes.at(-1)).toContain('**plain words**');
  });

  it('makes headings and lists from the toolbar', () => {
    const { inner, changes } = open('a title');
    inner.editor.commands.selectAll();
    inner.heading(2);
    expect(changes.at(-1)).toContain('## a title');

    inner.bullets();
    expect(changes.at(-1)).toContain('- ');
  });

  it('puts a picture in as Markdown that the site already knows how to show', () => {
    const { inner, changes } = open('');

    inner.insertImage('/api/media/abc', 'a chart');

    expect(changes.at(-1)).toContain('![a chart](/api/media/abc)');
  });

  it('adds a link only for an address that is safe to follow', () => {
    const { inner, changes } = open('go here');
    inner.editor.commands.selectAll();

    inner.link('javascript:alert(1)');
    expect(changes.at(-1) ?? '').not.toContain('javascript');

    inner.link('https://example.com/page');
    expect(changes.at(-1)).toContain('[go here](https://example.com/page)');
  });

  it('shows the server reason when a picture is refused', () => {
    const { fixture, root } = open('');
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const input = root.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });

    input.dispatchEvent(new Event('change'));
    TestBed.inject(HttpTestingController).expectOne((r) => r.method === 'POST').flush({ title: 'That file type is not allowed.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(root.querySelector('[role=alert]')?.textContent).toContain('not allowed');
  });

  it('keeps a Mermaid diagram as a Mermaid block when something else in the text is edited', () => {
    const { inner, changes } = open('Intro\n\n```mermaid\ngraph TD\n  A-->B\n```\n');
    inner.editor.commands.focus();

    inner.insertImage('/api/media/x', 'pic');

    expect(changes.at(-1)).toContain('```mermaid');
    expect(changes.at(-1)).toContain('A-->B');
  });

  it('keeps a table as a table when something else in the text is edited', () => {
    const { fixture, inner, changes } = open('Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
    inner.editor.commands.focus('start');

    inner.insertImage('/api/media/x', 'pic');

    expect((fixture.nativeElement as HTMLElement).querySelector('table')).not.toBeNull();
    expect(changes.at(-1)).toMatch(/\|\s*a\s*\|\s*b\s*\|/);
    expect(changes.at(-1)).toMatch(/\|\s*-{3,}/);
    expect(changes.at(-1)).toMatch(/\|\s*1\s*\|\s*2\s*\|/);
  });

  it('lets go of the editor when it is removed', () => {
    const { fixture, inner } = open('x');
    const editor = inner.editor;

    fixture.destroy();

    expect(editor.isDestroyed).toBe(true);
  });
});
