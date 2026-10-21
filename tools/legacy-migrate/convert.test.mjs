import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { altFromFile, convert } from './convert.mjs';

test('image.axd links become media URLs and are listed for fetching', () => {
  const { markdown, images } = convert('<p><img src="/image.axd?picture=/Host/PublishBlog/001-create_site.png" alt="" width="650" /><br />Figure 1 Creating a site</p>', { slug: 'publish' });
  assert.match(markdown, /!\[create site\]\(\/media\/legacy\/publish\/001-create_site\.png\)/);
  assert.match(markdown, /Figure 1 Creating a site/);
  assert.deepEqual(images.map((i) => [i.kind, i.file, i.remote]), [['axd', '001-create_site.png', '/Host/PublishBlog/001-create_site.png']]);
});

test('inline base64 images are written to files and referenced by URL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'legacy-'));
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
  const { markdown, images } = convert(`<p><img src="data:image/png;base64,${png}" alt="Overview" /></p>`, { slug: 'about', outDir: dir });
  assert.equal(markdown, '![Overview](/media/legacy/about/figure-1.png)');
  assert.equal(images[0].kind, 'data');
  assert.equal(readFileSync(join(dir, 'figure-1.png')).length, 8);
});

test('external images are left alone', () => {
  const { markdown, images } = convert('<img src="https://example.com/a.png" alt="a" />', { slug: 's' });
  assert.equal(markdown, '![a](https://example.com/a.png)');
  assert.equal(images[0].kind, 'external');
});

test('pre blocks become fenced code and keep a language hint', () => {
  const { markdown } = convert('<pre class="brush: csharp">var x = 1;\nvar y = 2;</pre>', { slug: 's' });
  assert.equal(markdown, '```csharp\nvar x = 1;\nvar y = 2;\n```');
});

test('pre with a nested code element keeps the text and escapes nothing inside', () => {
  const { markdown } = convert('<pre><code class="language-xml">&lt;a b="1" /&gt;</code></pre>', { slug: 's' });
  assert.equal(markdown, '```xml\n<a b="1" />\n```');
});

test('tables, lists, links and nbsp convert to GFM', () => {
  const { markdown } = convert('<p>See&nbsp;<a href="https://x.test">x</a></p><ol><li>one</li><li>two</li></ol><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>', { slug: 's' });
  assert.match(markdown, /See \[x\]\(https:\/\/x\.test\)/);
  assert.match(markdown, /1\. {2}one|1\. one/);
  assert.match(markdown, /\| A \| B \|/);
});

test('alt text from file names', () => {
  assert.equal(altFromFile('/a/b/004-PublishDialog.png'), 'PublishDialog');
  assert.equal(altFromFile('Mindmap.jpg'), 'Mindmap');
});

test('wiki commands: opening markers and navigation paragraphs are removed, inline ones keep their text, all are reported', () => {
  const { markdown, wikiCommands } = convert(
    '<p>[Page:NamedPipeListener]</p><p>[Page:DCI Abstract|DciAbstract] * [DciIntroduction]</p><p>[Page:Guide]<br /><em>Intro text</em></p><p>See [Page:the guide|GuidePage] now.</p>',
    { slug: 's' });
  assert.equal(markdown, '*Intro text*\n\nSee the guide now.');
  assert.equal(wikiCommands.length, 5);
  assert.ok(wikiCommands.some((c) => c.includes('NamedPipeListener') && c.includes('opening marker removed')));
  assert.ok(wikiCommands.some((c) => c.includes('(kept as text)')));
});

test('an image with no source is dropped and listed as empty', () => {
  const { markdown, images } = convert('<p>Before <img alt="" /> after</p>', { slug: 's' });
  assert.equal(markdown, 'Before  after');
  assert.deepEqual(images.map((i) => i.kind), ['empty']);
});

test('a pipe-separated bar of bracketed names (the legacy wiki navigation) is removed', () => {
  const { markdown, wikiCommands } = convert('<p>[Admin] | [Dashboard] | [Content]</p><p>Body</p>', { slug: 's' });
  assert.equal(markdown, 'Body');
  assert.equal(wikiCommands.length, 1);
});
