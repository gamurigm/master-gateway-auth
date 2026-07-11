import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SystemModule, CreateModuleDto, UpdateModuleDto } from './api.models';

@Injectable({ providedIn: 'root' })
export class ModulesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  findAll(): Observable<SystemModule[]> {
    return this.http.get<SystemModule[]>(`${this.apiUrl}/modules`);
  }

  findOne(id: string): Observable<SystemModule> {
    return this.http.get<SystemModule>(`${this.apiUrl}/modules/${id}`);
  }

  create(dto: CreateModuleDto): Observable<SystemModule> {
    return this.http.post<SystemModule>(`${this.apiUrl}/modules`, dto);
  }

  update(id: string, dto: UpdateModuleDto): Observable<SystemModule> {
    return this.http.put<SystemModule>(`${this.apiUrl}/modules/${id}`, dto);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/modules/${id}`);
  }
}
