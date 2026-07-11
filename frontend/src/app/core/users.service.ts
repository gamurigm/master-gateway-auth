import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, CreateUserDto, UpdateUserDto, PaginatedResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  findAll(page = 1, limit = 20): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/users`, {
      params: { page, limit },
    });
  }

  findOne(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}`);
  }

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, dto);
  }

  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, dto);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/users/${id}`);
  }
}
