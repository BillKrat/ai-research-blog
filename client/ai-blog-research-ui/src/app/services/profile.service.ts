import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Mirrors the backend's ProfileField (ProfileController.cs) - one schema-driven form field,
 * not a hand-coded username/email/displayName shape. See docs/SESSION_HANDOFF.md's 2026-09-23
 * "NEXT UP" entry, gap 3, and poc/nquad-end-to-end-poc's app-screen.html for the pattern this
 * mirrors client-side. */
export interface ProfileField {
  id: string;
  name: string;
  type: string;
  isRequired: boolean;
  isReadOnly: boolean;
  value: string;
}

export interface ProfileResponse {
  fields: ProfileField[];
}

export interface UpdateProfileRequest {
  email: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  getMyProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${environment.apiUrl}/api/profile/me`);
  }

  updateMyProfile(request: UpdateProfileRequest): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(`${environment.apiUrl}/api/profile/me`, request);
  }
}
