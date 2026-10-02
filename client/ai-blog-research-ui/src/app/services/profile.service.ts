import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityDataModel, EntityFormModel } from '../models/entity-form.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  getMyProfile(): Observable<EntityFormModel> {
    return this.http.get<EntityFormModel>(`${environment.apiUrl}/api/profile/me`);
  }

  updateMyProfile(request: EntityDataModel): Observable<EntityFormModel> {
    return this.http.put<EntityFormModel>(`${environment.apiUrl}/api/profile/me`, request);
  }

  /** Always rejected by the server's delete-own-account guard - see Profile's "Delete my account" action. */
  deleteMyAccount(): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/profile/me`);
  }
}
