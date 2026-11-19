import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { TestStepsPopout, extractSection } from './test-steps-popout';

const content = ['## Run it locally', 'run', '', '## Test steps', '1. Go. Expect: **ok**', '2. Stop.', '', '## After approval', '- [ ] live'].join('\n');

describe('extractSection', () => {
  it('returns the section under the heading up to the next heading of the same level', () => {
    expect(extractSection(content, 'Test steps')).toBe('1. Go. Expect: **ok**\n2. Stop.');
  });

  it('matches the heading without regard to case and runs to the end when it is last', () => {
    expect(extractSection('# Title\n## test STEPS\nonly', 'Test steps')).toBe('only');
  });

  it('is null when there is no such heading', () => {
    expect(extractSection('## Other\nx', 'Test steps')).toBeNull();
  });
});

describe('TestStepsPopout', () => {
  function open() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMarkdown(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'i1' } } } },
      ],
    });
    const fixture = TestBed.createComponent(TestStepsPopout);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), root: fixture.nativeElement as HTMLElement };
  }

  it('loads the item and shows only its Test steps, with the item title', async () => {
    const { fixture, http, root } = open();
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/collaboration/i1')).flush({
      contractVersion: 1,
      schema: { schemaIri: 'urn:c', fields: [] },
      entity: { entityId: 'i1', values: { Title: 'Tenant scoping', Content: content } },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Tenant scoping');
    expect(root.textContent).toContain('Go.');
    expect(root.textContent).not.toContain('live');
    expect(root.textContent).not.toContain('run');
  });

  it('says so when the item has no Test steps', async () => {
    const { fixture, http, root } = open();
    http.expectOne((r) => r.url.endsWith('/api/collaboration/i1')).flush({
      contractVersion: 1,
      schema: { schemaIri: 'urn:c', fields: [] },
      entity: { entityId: 'i1', values: { Title: 'T', Content: '## Other\nx' } },
    });
    fixture.detectChanges();

    expect(root.querySelector('.steps__none')?.textContent).toContain('no Test steps');
  });
});
