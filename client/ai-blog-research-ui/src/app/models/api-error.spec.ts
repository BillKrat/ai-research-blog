import { HttpErrorResponse } from '@angular/common/http';
import { describeApiError } from './api-error';

const failure = (status: number, error?: unknown) => new HttpErrorResponse({ status, error });

describe('describeApiError', () => {
  it('lists every field error the server wrote', () => {
    const messages = describeApiError(
      failure(400, {
        errors: {
          DOB: ['The DOB field is not in the right format. Expected a date such as 1961-11-19.'],
          Phone: ['The Phone field is not in the right format. Expected a valid String.'],
        },
      }),
    );

    expect(messages).toEqual([
      'The DOB field is not in the right format. Expected a date such as 1961-11-19.',
      'The Phone field is not in the right format. Expected a valid String.',
    ]);
  });

  it('shows the business rule message for a 409', () => {
    expect(describeApiError(failure(409, 'You cannot delete your own account.'))).toEqual(['You cannot delete your own account.']);
  });

  it('shows the shielded title and the log reference for a 500', () => {
    const messages = describeApiError(failure(500, { title: 'Something went wrong on the server.', errorId: 'abc-123' }));

    expect(messages).toEqual(['Something went wrong on the server. Reference: abc-123.']);
  });

  it('copes with a 500 that has no reference or body', () => {
    expect(describeApiError(failure(500))[0]).toContain('logged');
  });

  it('says so when the server cannot be reached', () => {
    expect(describeApiError(failure(0))[0]).toContain('reach the server');
  });

  it('explains 401 and 403 without status codes', () => {
    expect(describeApiError(failure(401))[0]).toContain('Sign in');
    expect(describeApiError(failure(403))[0]).toContain('permission');
  });

  it('falls back for a 400 with no field errors and for non-HTTP errors', () => {
    expect(describeApiError(failure(400, {}), 'Could not save.')).toEqual(['Could not save.']);
    expect(describeApiError(new Error('boom'), 'Could not save.')).toEqual(['Could not save.']);
  });
});
