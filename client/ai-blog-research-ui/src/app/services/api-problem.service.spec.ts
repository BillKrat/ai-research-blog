import { HttpErrorResponse } from '@angular/common/http';
import { ApiProblemService } from './api-problem.service';

describe('ApiProblemService', () => {
  const service = () => new ApiProblemService();

  it('says what is missing when the API answered 503 with its startup problems', () => {
    const s = service();
    s.reportHttp(
      new HttpErrorResponse({
        status: 503,
        error: { title: 'The API could not start.', problems: [{ key: 'ConnectionStrings:LiveData', message: 'not set.', fix: 'Run the usersecret command.' }] },
      }),
    );

    expect(s.messages()[0]).toBe('The API could not start.');
    expect(s.messages()[1]).toContain('ConnectionStrings:LiveData');
    expect(s.messages()[1]).toContain('usersecret');
  });

  it('says the API is not answering when there was no response at all', () => {
    const s = service();
    s.reportHttp(new HttpErrorResponse({ status: 0 }));

    expect(s.messages()[0]).toContain("isn't answering");
  });

  it('leaves a validation error to the screen that asked', () => {
    const s = service();
    s.reportHttp(new HttpErrorResponse({ status: 400 }));

    expect(s.messages()).toEqual([]);
  });

  it('clears when the API answers again', () => {
    const s = service();
    s.reportHttp(new HttpErrorResponse({ status: 0 }));
    s.clear();

    expect(s.messages()).toEqual([]);
  });
});
