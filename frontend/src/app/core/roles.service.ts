import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Role, RoleDetail, CreateRoleDto, UpdateRoleDto } from './api.models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  findAll(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  findOne(id: string): Observable<RoleDetail> {
    return this.http.get<RoleDetail>(`${this.apiUrl}/roles/${id}`);
  }

  create(dto: CreateRoleDto): Observable<Role> {
    return this.http.post<Role>(`${this.apiUrl}/roles`, dto);
  }

  update(id: string, dto: UpdateRoleDto): Observable<Role> {
    return this.http.put<Role>(`${this.apiUrl}/roles/${id}`, dto);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/roles/${id}`);
  }

  assignUser(roleId: string, userId: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/roles/${roleId}/users`, { userId });
  }

  unassignUser(roleId: string, userId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/roles/${roleId}/users/${userId}`);
  }

  assignModule(roleId: string, moduleId: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/roles/${roleId}/modules`, { moduleId });
  }

  unassignModule(roleId: string, moduleId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/roles/${roleId}/modules/${moduleId}`);
  }

  assignMenu(roleId: string, menuId: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/roles/${roleId}/menus`, { menuId });
  }

  unassignMenu(roleId: string, menuId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/roles/${roleId}/menus/${menuId}`);
  }
}
