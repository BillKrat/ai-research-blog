import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { REQUEST_TIMEOUT_MS } from '../interceptors/timeout.interceptor';
import { MediaService } from './media.service';

describe('MediaService', () => {
  it('posts the file as form data and allows an upload longer than an ordinary call', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const controller = TestBed.inject(HttpTestingController);
    TestBed.inject(MediaService).upload(new File(['x'], 'a.png', { type: 'image/png' })).subscribe();

    const request = controller.expectOne((r) => r.url.endsWith('/api/media'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.context.get(REQUEST_TIMEOUT_MS)).toBeGreaterThanOrEqual(60_000);
    request.flush({ id: 'm1', url: '/api/media/m1/a.png' });
  });
});
