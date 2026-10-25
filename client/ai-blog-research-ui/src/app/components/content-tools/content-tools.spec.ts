import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ContentTools } from './content-tools';

/**
 * Add, Edit and Delete follow the person's rights: only the buttons their rights allow are shown (the server still refuses the rest).
 * A person with no right sees no toolbar at all, and an anonymous visitor makes no request.
 */
describe('ContentTools', () => {
  function render(kind: 'posts' | 'pages', signedIn: boolean, rights: string[] | null): { fixture: ComponentFixture<ContentTools>; labels: () => string[] } {
    TestBed.configureTestingModule({
      imports: [ContentTools],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { isAuthenticated: () => signedIn } }],
    });
    const fixture = TestBed.createComponent(ContentTools);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('slug', 'hello');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    if (rights === null) {
      http.expectNone((r) => r.url.endsWith('/api/auth/rights'));
    } else {
      http.expectOne((r) => r.url.endsWith('/api/auth/rights')).flush({ userName: 'x', rights: rights.map((name) => ({ name, description: '' })) });
    }

    fixture.detectChanges();
    const labels = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? '');
    return { fixture, labels };
  }

  it('shows only the buttons the rights allow: a writer who may create but not edit or delete sees Add only', () => {
    const { labels } = render('posts', true, ['posts.read', 'posts.create']);

    expect(labels()).toEqual(['Add a post']);
  });

  it('shows all three for a person who may create, edit any and delete any post', () => {
    const { labels } = render('posts', true, ['posts.create', 'posts.edit.any', 'posts.delete.any']);

    expect(labels()).toEqual(['Add a post', 'Edit this post', 'Delete this post']);
  });

  it('does not treat the right to edit only your own posts as the right to edit this one', () => {
    const { labels } = render('posts', true, ['posts.edit.own', 'posts.delete.own']);

    expect(labels()).toEqual([]);
  });

  it('uses the page rights for a page: one right to create, change and delete', () => {
    expect(render('pages', true, ['pages.edit']).labels()).toEqual(['Add a page', 'Edit this page', 'Delete this page']);
  });

  it('shows no toolbar to a signed-in person with no right, and an anonymous visitor makes no request', () => {
    expect(render('posts', true, []).fixture.nativeElement.querySelector('.content-tools')).toBeNull();

    TestBed.resetTestingModule();
    const anonymous = render('posts', false, null);
    expect(anonymous.fixture.nativeElement.querySelector('.content-tools')).toBeNull();
  });
});
