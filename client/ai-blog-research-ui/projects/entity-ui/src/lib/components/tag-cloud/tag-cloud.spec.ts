import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CloudTag, TagCloud, tagSize } from './tag-cloud';

@Component({ imports: [TagCloud], template: `<adv-tag-cloud [tags]="tags" />` })
class Host {
  tags: CloudTag[] = [
    { name: 'Angular', count: 10, link: ['/tag', 'Angular'], editLink: ['/admin/tags', 't1'] },
    { name: 'Mermaid', count: 1, link: ['/tag', 'Mermaid'], editLink: ['/admin/tags', 't2'] },
    { name: 'Unused', count: 0, link: ['/tag', 'Unused'] },
  ];
}

describe('tagSize', () => {
  it('grows with use: the most used tag is the biggest, the least used the smallest, in between in proportion', () => {
    expect(tagSize(10, 0, 10)).toBeGreaterThan(tagSize(5, 0, 10));
    expect(tagSize(5, 0, 10)).toBeGreaterThan(tagSize(0, 0, 10));
    expect(tagSize(0, 0, 10)).toBe(tagSize(0, 0, 3));
    expect(tagSize(10, 0, 10)).toBe(tagSize(3, 0, 3));
  });

  it('gives every tag the same middle size when all are used the same, and never divides by zero', () => {
    expect(tagSize(4, 4, 4)).toBe(tagSize(7, 7, 7));
    expect(Number.isFinite(tagSize(0, 0, 0))).toBe(true);
  });
});

describe('TagCloud', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows every tag as a link to its posts, bigger the more it is used, with its count', () => {
    const root = render();
    const tags = Array.from(root.querySelectorAll('a.tag-cloud__tag')) as HTMLAnchorElement[];

    expect(tags.map((a) => a.getAttribute('href'))).toEqual(['/tag/Angular', '/tag/Mermaid', '/tag/Unused']);
    const sizes = tags.map((a) => parseFloat(a.style.fontSize));
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
    expect(tags[0].textContent).toContain('10');
  });

  it('offers an edit link only for tags that have one', () => {
    const root = render();
    const edits = Array.from(root.querySelectorAll('a.tag-cloud__edit')) as HTMLAnchorElement[];

    expect(edits.map((a) => a.getAttribute('href'))).toEqual(['/admin/tags/t1', '/admin/tags/t2']);
    expect(edits[0].getAttribute('aria-label')).toBe('Edit Angular');
  });
});
