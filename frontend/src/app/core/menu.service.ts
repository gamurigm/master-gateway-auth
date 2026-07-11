import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MenuModule, Menu, CreateMenuDto, UpdateMenuDto } from './api.models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  tree(): Observable<MenuModule[]> {
    return this.http.get<MenuModule[]>(`${this.apiUrl}/menus/tree`);
  }

  findAll(): Observable<Menu[]> {
    return this.http.get<Menu[]>(`${this.apiUrl}/menus`);
  }

  create(dto: CreateMenuDto): Observable<Menu> {
    return this.http.post<Menu>(`${this.apiUrl}/menus`, dto);
  }

  update(id: string, dto: UpdateMenuDto): Observable<Menu> {
    return this.http.put<Menu>(`${this.apiUrl}/menus/${id}`, dto);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/menus/${id}`);
  }
}
