// Converts one legacy BlogEngine.NET post or page body (HTML) to Markdown.
//
//   node convert.mjs --slug <slug> [--in <file.html>] [--out-dir <dir>] [--media-base /media/legacy/<slug>]
//
// Reads HTML from --in or stdin and prints JSON on stdout: { markdown, images: [{ original, kind, file, url }] }.
//   kind "axd"      a BlogEngine /image.axd?picture=/A/B/c.png link; the file lives at App_Data/files/A/B/c.png on the legacy host
//                   (the caller fetches it); the Markdown points at <media-base>/c.png
//   kind "data"     an inline base64 image; decoded into --out-dir as figure-N.<ext>, the Markdown points at <media-base>/figure-N.<ext>
//   kind "external" any other absolute URL; left as it is
// Everything else is plain Markdown (GFM tables, fenced code with a language hint when the legacy markup names one).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

/** "001-create_site.png" -> "create site" (a readable alt text when the legacy markup has none). */
export function altFromFile(file) {
  return basename(file).replace(/\.[^.]+$/, '').replace(/^\d+[a-z]?[-_ ]*/i, '').replace(/[-_]+/g, ' ').trim();
}

/** The language named by the legacy syntax highlighter or editor: "brush: csharp", "language-csharp", "lang-csharp", "csharp". */
export function languageOf(element) {
  const classes = `${element.getAttribute('class') ?? ''} ${element.firstChild?.getAttribute?.('class') ?? ''}`;
  const brush = /brush:\s*([a-z0-9#+-]+)/i.exec(classes) ?? /\blang(?:uage)?-([a-z0-9#+-]+)/i.exec(classes);
  const name = (brush?.[1] ?? '').toLowerCase();
  return { csharp: 'csharp', 'c#': 'csharp', cs: 'csharp', js: 'javascript', ts: 'typescript', xml: 'xml', html: 'html', json: 'json', sql: 'sql', powershell: 'powershell', bash: 'bash', plain: '' }[name] ?? name;
}

export function convert(html, { slug, mediaBase = `/media/legacy/${slug}`, outDir = null } = {}) {
  const images = [];
  let figure = 0;

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
  turndown.use(gfm);

  turndown.addRule('legacyImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const original = node.getAttribute('src') ?? '';
      let alt = (node.getAttribute('alt') ?? '').trim();
      if (!original.trim()) {
        // an <img> with no source (the editor left it behind when the picture was removed) shows nothing on the legacy site either
        images.push({ original: '', kind: 'empty', file: null, url: null });
        return '';
      }

      const axd = /image\.axd\?picture=([^&"]+)/i.exec(original);
      const data = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(original);
      if (axd) {
        const file = basename(decodeURIComponent(axd[1]));
        images.push({ original, kind: 'axd', file, remote: decodeURIComponent(axd[1]), url: `${mediaBase}/${file}` });
        return `![${alt || altFromFile(file)}](${mediaBase}/${file})`;
      }

      if (data) {
        figure += 1;
        const file = `figure-${figure}.${EXTENSIONS[data[1].toLowerCase()] ?? 'png'}`;
        if (outDir) {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(join(outDir, file), Buffer.from(data[2], 'base64'));
        }

        images.push({ original: `data:${data[1]};base64,(${data[2].length} chars)`, kind: 'data', file, url: `${mediaBase}/${file}` });
        return `![${alt || `Figure ${figure}`}](${mediaBase}/${file})`;
      }

      images.push({ original, kind: 'external', file: null, url: original });
      return `![${alt}](${original})`;
    },
  });

  // <pre> (with or without an inner <code>) becomes a fenced block that keeps the language hint
  turndown.addRule('legacyPre', {
    filter: 'pre',
    replacement: (_content, node) => {
      const text = node.textContent.replace(/\r\n/g, '\n').replace(/\n+$/, '');
      const fence = text.includes('```') ? '~~~~' : '```';
      return `\n\n${fence}${languageOf(node)}\n${text}\n${fence}\n\n`;
    },
  });

  // The fork's wiki extension wrote commands into the body, for example [Page:NamedPipeListener], [Page:Show|PageName] or navigation
  // bars such as "[Page:A|PageA] * [PageB]". The new site has no wiki, so: a command that opens a paragraph is removed (a navigation
  // marker), a paragraph made only of such tokens and separators is removed, and a command inside running text keeps its display
  // text. Every one is reported, never silent.
  const wikiCommands = [];
  const withoutWiki = html
    .replace(/(<p>\s*(?:<img[^>]*>)?\s*)\[Page:([^\]]+)\](?:\s|&nbsp;|<br\s*\/?>)*/g, (_all, open, argument) => {
      wikiCommands.push(`[Page:${argument}] (opening marker removed)`);
      return open;
    })
    .replace(/<p>\s*(?:(?:\[[^\]\[]*\]|\*|\||&nbsp;|\s)+)<\/p>/g, (all) => {
      wikiCommands.push(`${all.replace(/<\/?p>/g, '').trim()} (navigation paragraph removed)`);
      return '';
    })
    .replace(/\[Page:([^\]|]+)(?:\|([^\]]+))?\]/g, (_all, shown, target) => {
      wikiCommands.push(`[Page:${shown}${target ? `|${target}` : ''}] (kept as text)`);
      return shown;
    });

  const markdown = turndown
    .turndown(withoutWiki.replace(/&nbsp;/g, ' '))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { markdown, images, wikiCommands };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('convert.mjs')) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  const slug = args.get('--slug');
  if (!slug) {
    console.error('--slug is required');
    process.exit(2);
  }

  const html = readFileSync(args.get('--in') ?? 0, 'utf8');
  process.stdout.write(JSON.stringify(convert(html, { slug, mediaBase: args.get('--media-base'), outDir: args.get('--out-dir') })));
}
