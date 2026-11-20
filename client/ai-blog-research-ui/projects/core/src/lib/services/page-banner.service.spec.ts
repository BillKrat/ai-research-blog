import { TestBed } from '@angular/core/testing';
import { PageBannerService } from './page-banner.service';

describe('PageBannerService', () => {
  it('holds the banner a page set until it is cleared', () => {
    const service = TestBed.inject(PageBannerService);
    expect(service.banner()).toBeNull();

    service.show({ text: 'Showing 4 occurrences' });
    expect(service.banner()?.text).toBe('Showing 4 occurrences');

    service.clear();
    expect(service.banner()).toBeNull();
  });
});
