import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LabelService } from './labels';
import { LanguageLoader } from './language-loader';

describe('LanguageLoader', () => {
  let http: HttpTestingController;
  let loader: LanguageLoader;
  let labels: LabelService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    loader = TestBed.inject(LanguageLoader);
    labels = TestBed.inject(LabelService);
  });

  it('puts the table of the site language into the label service', () => {
    loader.load().subscribe();
    http.expectOne((r) => r.url.endsWith('/api/public/labels')).flush({ language: 'de', labels: { save: 'Speichern' } });

    expect(labels.language()).toBe('de');
    expect(labels.text('save')).toBe('Speichern');
    expect(labels.text('delete')).toBe('Delete');
  });

  it('keeps English when the API cannot be reached, so the screens never wait on it', () => {
    loader.load().subscribe();
    http.expectOne((r) => r.url.endsWith('/api/public/labels')).flush('down', { status: 500, statusText: 'Server Error' });

    expect(labels.language()).toBe('en');
    expect(labels.text('save')).toBe('Save');
  });

  it('keeps English for an answer that is not a table', () => {
    loader.load().subscribe();
    http.expectOne((r) => r.url.endsWith('/api/public/labels')).flush({ language: 7, labels: 'oops' });

    expect(labels.language()).toBe('en');
    expect(labels.text('save')).toBe('Save');
  });
});
