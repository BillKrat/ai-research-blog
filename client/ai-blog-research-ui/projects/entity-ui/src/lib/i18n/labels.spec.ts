import { TestBed } from '@angular/core/testing';
import { LABELS, LabelPipe, LabelService } from './labels';

describe('label seam', () => {
  let service: LabelService;
  let pipe: LabelPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LabelService);
    pipe = TestBed.runInInjectionContext(() => new LabelPipe());
  });

  it('answers English by default', () => {
    expect(pipe.transform('save')).toBe('Save');
  });

  it('answers the language table over English, key by key, and falls back to English for a missing key', () => {
    service.load('de', { save: 'Speichern' });

    expect(pipe.transform('save')).toBe('Speichern');
    expect(pipe.transform('delete')).toBe('Delete');
    expect(service.language()).toBe('de');
  });

  it('fills {0} and {1} with the arguments, so a name can sit inside a translated sentence', () => {
    expect(pipe.transform('removeNamed', 'Angular')).toBe('Remove Angular');
    service.load('de', { removeNamed: '{0} entfernen' });
    expect(pipe.transform('removeNamed', 'Angular')).toBe('Angular entfernen');
  });

  it('repaints on a language switch: the pipe is not memoised on its key', () => {
    expect(pipe.transform('save')).toBe('Save');
    service.load('fr', { save: 'Enregistrer' });
    expect(pipe.transform('save')).toBe('Enregistrer');
    service.load('en', {});
    expect(pipe.transform('save')).toBe('Save');
  });

  it('ignores a table value that is not text, so a bad language file can never blank a button', () => {
    service.load('xx', { save: '', delete: 7 as unknown as string });

    expect(pipe.transform('save')).toBe('Save');
    expect(pipe.transform('delete')).toBe('Delete');
  });

  it('declares every key with some text', () => {
    for (const [key, text] of Object.entries(LABELS)) {
      expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });
});
