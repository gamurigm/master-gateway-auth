import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MenuModule } from './api.models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  tree(): Observable<MenuModule[]> {
    return this.http.get<MenuModule[]>(`${this.apiUrl}/menus/tree`);
  }
}

