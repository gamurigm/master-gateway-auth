import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, RoleSummary, SessionResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap((response) => {
        sessionStorage.setItem('tempToken', response.tempToken);
        sessionStorage.setItem('roles', JSON.stringify(response.roles));
        sessionStorage.setItem('loginUser', JSON.stringify(response.user));
      }),
    );
  }

  selectRole(roleId: string): Observable<SessionResponse> {
    const tempToken = sessionStorage.getItem('tempToken');
    return this.http.post<SessionResponse>(`${this.apiUrl}/auth/select-role`, { tempToken, roleId }).pipe(
      tap((response) => {
        this.storeSession(response);
        sessionStorage.removeItem('tempToken');
        sessionStorage.removeItem('roles');
      }),
    );
  }

  refreshSession(): Observable<SessionResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new Error('Refresh token no disponible'));
    }

    return this.http.post<SessionResponse>(`${this.apiUrl}/auth/refresh-token`, { refreshToken }).pipe(
      tap((response) => this.storeSession(response)),
    );
  }

  logout(): Observable<{ success: boolean }> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      this.clearSession();
      return of({ success: true });
    }

    return this.http.post<{ success: boolean }>(`${this.apiUrl}/auth/logout`, { refreshToken }).pipe(
      tap(() => this.clearSession()),
    );
  }

  clearSession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentRole');
    sessionStorage.removeItem('tempToken');
    sessionStorage.removeItem('roles');
    sessionStorage.removeItem('loginUser');
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  getRolesFromLogin(): RoleSummary[] {
    const raw = sessionStorage.getItem('roles');
    return raw ? (JSON.parse(raw) as RoleSummary[]) : [];
  }

  getCurrentRole(): RoleSummary | null {
    const raw = localStorage.getItem('currentRole');
    return raw ? (JSON.parse(raw) as RoleSummary) : null;
  }

  hasTempToken() {
    return Boolean(sessionStorage.getItem('tempToken'));
  }

  isAuthenticated() {
    return Boolean(this.getAccessToken());
  }

  private storeSession(response: SessionResponse) {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('currentRole', JSON.stringify(response.role));
  }
}
