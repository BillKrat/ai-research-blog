import { TestBed } from '@angular/core/testing';
import { THEMES, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let store: Map<string, string>;

  const stubStorage = (blocked = false) => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => {
        if (blocked) {
          throw new Error('blocked');
        }
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (blocked) {
          throw new Error('blocked');
        }
        store.set(key, value);
      },
      removeItem: (key: string) => void store.delete(key),
    });
  };

  const make = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(ThemeService);
  };

  beforeEach(() => {
    store = new Map();
    stubStorage();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('offers the twelve Material palettes, azure first (the look the site always had)', () => {
    expect(THEMES).toHaveLength(12);
    expect(THEMES[0]).toBe('azure');
  });

  it('starts azure and puts no theme attribute on the page for it', () => {
    const service = make();
    TestBed.tick();
    expect(service.theme()).toBe('azure');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('applies the site default until the visitor chooses', () => {
    const service = make();
    service.setSiteDefault('violet');
    TestBed.tick();
    expect(service.theme()).toBe('violet');
    expect(document.documentElement.getAttribute('data-theme')).toBe('violet');
  });

  it('keeps the visitor choice over the site default, and remembers it in the browser', () => {
    const service = make();
    service.choose('rose');
    service.setSiteDefault('violet');
    TestBed.tick();
    expect(service.theme()).toBe('rose');
    expect(store.get('adv.theme')).toBe('rose');
    expect(document.documentElement.getAttribute('data-theme')).toBe('rose');
  });

  it('paints the last known theme at start-up so the page does not flash azure', () => {
    store.set('adv.siteTheme', 'orange');
    expect(make().theme()).toBe('orange');
  });

  it('ignores a name that is not a palette (stored or given)', () => {
    store.set('adv.theme', '<script>');
    const service = make();
    expect(service.theme()).toBe('azure');
    service.choose('hot-pink');
    expect(service.theme()).toBe('azure');
    service.setSiteDefault('nonsense');
    expect(service.theme()).toBe('azure');
  });

  it('works when browser storage is refused', () => {
    stubStorage(true);
    const service = make();
    service.choose('green');
    expect(service.theme()).toBe('green');
  });
});
