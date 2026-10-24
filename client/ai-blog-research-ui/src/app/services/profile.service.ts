import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityDataModel, EntityFormModel } from '../models/entity-form.model';

/** One thing the signed-in person may do, with what it allows. */
export interface MyRight {
  name: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  getMyProfile(): Observable<EntityFormModel> {
    return this.http.get<EntityFormModel>(`${environment.apiUrl}/api/profile/me`);
  }

  updateMyProfile(request: EntityDataModel): Observable<EntityFormModel> {
    return this.http.put<EntityFormModel>(`${environment.apiUrl}/api/profile/me`, request);
  }

  /** What the server will allow this person to do (the rights of their roles); it is what the admin menu and the routes follow. */
  getMyRights(): Observable<{ userName: string | null; rights: MyRight[] }> {
    return this.http.get<{ userName: string | null; rights: MyRight[] }>(`${environment.apiUrl}/api/auth/rights`);
  }

  /** Always rejected by the server's delete-own-account guard - see Profile's "Delete my account" action. */
  deleteMyAccount(): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/profile/me`);
  }
}
