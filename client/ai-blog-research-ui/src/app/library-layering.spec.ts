import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * The shape of the client libraries (S10), held by a test the way the .NET dependency rules are. Libraries are layered, a library only imports downward,
 * and none imports the host app or reaches outside its own folder. (ng-packagr also refuses an import of the app when a library is built; this fails
 * earlier, in the ordinary test run, and names the offending file.)
 */
const root = process.cwd();
const projects = join(root, 'projects');

/** What each library may import from the others; everything else is a violation. */
const allowed: Record<string, string[]> = {
  core: [],
  'entity-ui': ['core'],
  collaboration: ['core', 'entity-ui'],
  'blog-reader': ['core', 'entity-ui', 'collaboration'],
  admin: ['core', 'entity-ui', 'collaboration'],
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

function specifiers(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from\s+|import\()\s*'([^']+)'/g)].map((m) => m[1]);
}

describe('client library layering', () => {
  it('knows every library in the workspace', () => {
    const found = readdirSync(projects).filter((n) => statSync(join(projects, n)).isDirectory()).sort();
    expect(found).toEqual(Object.keys(allowed).sort());
  });

  for (const [lib, mayUse] of Object.entries(allowed)) {
    describe(`@adventures/${lib}`, () => {
      const dir = join(projects, lib);
      const files = sources(join(dir, 'src'));

      it('imports only the libraries beneath it', () => {
        const offences = files.flatMap((file) =>
          specifiers(file)
            .filter((s) => s.startsWith('@adventures/'))
            .map((s) => s.slice('@adventures/'.length))
            .filter((name) => !mayUse.includes(name))
            .map((name) => `${relative(root, file)} imports @adventures/${name}`),
        );
        expect(offences).toEqual([]);
      });

      it('never reaches outside its own folder (no host app, no environment file)', () => {
        const offences = files.flatMap((file) =>
          specifiers(file)
            .filter((s) => s.startsWith('.'))
            .filter((s) => {
              const target = resolve(dirname(file), s);
              return relative(dir, target).startsWith('..');
            })
            .map((s) => `${relative(root, file)} imports ${s}`),
        );
        expect(offences).toEqual([]);
      });

      it('is marked private, so npm publish refuses it (nothing here is published; publishing would be a deliberate act)', () => {
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { private?: boolean };
        expect(manifest.private).toBe(true);
      });

      it('declares the libraries it uses as peer dependencies, and no others', () => {
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { peerDependencies?: Record<string, string> };
        const declared = Object.keys(manifest.peerDependencies ?? {})
          .filter((n) => n.startsWith('@adventures/'))
          .map((n) => n.slice('@adventures/'.length))
          .sort();
        const used = [...new Set(files.flatMap((f) => specifiers(f)).filter((s) => s.startsWith('@adventures/')).map((s) => s.slice('@adventures/'.length)))].sort();
        expect(declared).toEqual(used);
      });
    });
  }

  it('keeps the app free of its own environment file outside app.config', () => {
    const app = join(root, 'src', 'app');
    const offences = sources(app)
      .filter((f) => !f.endsWith('app.config.ts'))
      .filter((f) => specifiers(f).some((s) => s.includes('environments/environment')))
      .map((f) => relative(root, f));
    expect(offences).toEqual([]);
    expect(existsSync(join(root, 'src', 'environments', 'environment.ts'))).toBe(true);
  });
});
