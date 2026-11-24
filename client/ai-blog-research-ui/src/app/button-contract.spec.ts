import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Row 13 (icons and language files): every button in every template is an icon, and all its words (hover text, screen-reader name, any visible
 * text) come from the label table by key (`'save' | label`), so a language file can replace them. Text the server supplies (the names of server-offered
 * actions) is the one exception and is listed below by expression. A new button that breaks this fails here, before it ships hard-coded English.
 */
const SERVER_TEXT = ['action.label', 'b.actionLabel', 'section.label']; // section.label: the admin menu section names, which the server sends already in the site language

const templates = (dir: string, found: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.angular'].includes(name)) {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      templates(path, found);
    } else if (name.endsWith('.html')) {
      found.push(path);
    }
  }
  return found;
};

interface Found {
  file: string;
  attributes: string;
  body: string;
}

const buttons = (): Found[] => {
  const result: Found[] = [];
  for (const file of templates(process.cwd())) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/<button\b((?:"[^"]*"|[^>"])*)>([\s\S]*?)<\/button>/g)) {
      result.push({ file: file.slice(process.cwd().length + 1).replaceAll('\\', '/'), attributes: match[1], body: match[2] });
    }
  }
  return result;
};

const describeButton = (b: Found): string => `${b.file}: <button ${b.attributes.replace(/\s+/g, ' ').trim().slice(0, 70)}>`;

const attribute = (attributes: string, name: string): string | null => {
  const match = new RegExp(`\\[?(?:attr\\.)?${name}\\]?="([^"]*)"`).exec(attributes);
  return match ? match[1] : null;
};

const fromTable = (expression: string): boolean => expression.includes('| label') || SERVER_TEXT.some((s) => expression.includes(s));

describe('button contract (icons and keyed text)', () => {
  it('finds the buttons (so the contract cannot pass by scanning nothing)', () => {
    expect(buttons().length).toBeGreaterThan(60);
  });

  it('gives every button an icon', () => {
    const bare = buttons().filter((b) => !b.body.includes('<mat-icon'));
    expect(bare.map(describeButton)).toEqual([]);
  });

  it('gives every button a hover text and a screen-reader name from the label table', () => {
    const wrong = buttons().filter((b) => {
      const tip = attribute(b.attributes, 'matTooltip');
      const aria = attribute(b.attributes, 'aria-label');
      return tip === null || aria === null || !fromTable(tip) || !fromTable(aria);
    });
    expect(wrong.map(describeButton)).toEqual([]);
  });

  it('keeps visible words behind keys too: no literal text inside a button except an icon name or a table lookup', () => {
    const literal = buttons().filter((b) => {
      const withoutIcons = b.body.replace(/<mat-icon[\s\S]*?<\/mat-icon>/g, '');
      const withoutLookups = withoutIcons.replace(/\{\{[\s\S]*?\}\}/g, (m) => (fromTable(m) || /^\{\{\s*[a-zA-Z_.()[\]]+\s*\}\}$/.test(m) ? '' : m));
      const withoutControlFlow = withoutLookups.replace(/@(if|else|for|switch|case|default)\b[^{]*\{|\}/g, '');
      return withoutControlFlow.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length > 0;
    });
    expect(literal.map(describeButton)).toEqual([]);
  });
});
