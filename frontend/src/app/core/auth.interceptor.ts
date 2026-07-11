import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();
  const authRequest = token && shouldAttachToken(request) ? withBearerToken(request, token) : request;

  return next(authRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401 && shouldRefresh(request)) {
        return authService.refreshSession().pipe(
          switchMap(() => {
            const nextToken = authService.getAccessToken();
            return next(nextToken ? withBearerToken(request, nextToken) : request);
          }),
          catchError((refreshError: unknown) => {
            authService.clearSession();
            void router.navigateByUrl('/login');
            return throwError(() => refreshError);
          }),
        );
      }

      if (error.status === 401 && !isAuthFlowRequest(request)) {
        authService.clearSession();
        void router.navigateByUrl('/login');
      }

      if (error.status === 403 && !isAuthFlowRequest(request)) {
        void router.navigateByUrl('/unauthorized');
      }

      return throwError(() => error);
    }),
  );
};

const withBearerToken = (request: HttpRequest<unknown>, token: string) =>
  request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

const shouldAttachToken = (request: HttpRequest<unknown>) => !isAuthFlowRequest(request);

const shouldRefresh = (request: HttpRequest<unknown>) => !isAuthFlowRequest(request);

const isAuthFlowRequest = (request: HttpRequest<unknown>) =>
  request.url.includes('/auth/login') ||
  request.url.includes('/auth/select-role') ||
  request.url.includes('/auth/refresh-token');
