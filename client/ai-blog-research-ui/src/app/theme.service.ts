import { Injectable, effect, signal } from '@angular/core';

/** The colour themes (Angular Material's twelve palettes; `styles.scss` has one set of colours for each). Azure is the look the site always had. */
export const THEMES = ['azure', 'blue', 'chartreuse', 'cyan', 'green', 'magenta', 'orange', 'red', 'rose', 'spring-green', 'violet', 'yellow'] as const;
export type ThemeName = (typeof THEMES)[number];

const CHOICE_KEY = 'adv.theme';
const SITE_KEY = 'adv.siteTheme';

const known = (value: string | null | undefined): ThemeName | null => THEMES.find((t) => t === value) ?? null;

/** Browser storage can be missing or refused (private windows); the page then starts from the defaults. */
function read(key: string): ThemeName | null {
  try {
    return known(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key: string, value: ThemeName): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered; the choice still applies for this visit
  }
}

/**
 * The colour theme of the page, next to dark or light: the site default (Admin > Settings > Theme) applies until the visitor picks one from the header,
 * and their choice, kept in this browser, wins from then on. The page carries it as `data-theme` on the html element (azure, the default, carries none).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly chosen = signal<ThemeName | null>(read(CHOICE_KEY));
  private readonly site = signal<ThemeName | null>(read(SITE_KEY));

  /** The theme in force: the visitor's choice, else the site default (the last one this browser saw until the settings are read), else azure. */
  readonly theme = (): ThemeName => this.chosen() ?? this.site() ?? 'azure';

  readonly themes = THEMES;

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (theme === 'azure') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    });
  }

  /** The visitor picks a theme; an unknown name is ignored. */
  choose(name: string): void {
    const theme = known(name);
    if (theme !== null) {
      this.chosen.set(theme);
      write(CHOICE_KEY, theme);
    }
  }

  /** The site default from the settings; an unknown name is ignored. */
  setSiteDefault(name: string | undefined): void {
    const theme = known(name);
    if (theme !== null) {
      this.site.set(theme);
      write(SITE_KEY, theme);
    }
  }
}
