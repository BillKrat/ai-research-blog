import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** One entry of the conversation under a post (the server sets the author and the time). */
export interface ConversationEntry {
  id: string;
  author: string;
  kind: 'Comment' | 'Decision' | string;
  created: string;
  body: string;
}

/** The conversation under a post, for administrators: read it, add to it. Entries are only added. */
@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);

  list(postId: string): Observable<ConversationEntry[]> {
    return this.http.get<ConversationEntry[]>(`${environment.apiUrl}/api/posts/${encodeURIComponent(postId)}/comments`);
  }

  add(postId: string, text: string, kind: 'Comment' | 'Decision'): Observable<ConversationEntry> {
    return this.http.post<ConversationEntry>(`${environment.apiUrl}/api/posts/${encodeURIComponent(postId)}/comments`, { text, kind });
  }
}
