import { Routes } from '@angular/router';
import { baseAppChildren } from './app-route-children';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './features/login/login.component';
import { SelectRoleComponent } from './features/select-role/select-role.component';
import { ShellComponent } from './features/shell/shell.component';
import { UnauthorizedComponent } from './features/unauthorized/unauthorized.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'select-role', component: SelectRoleComponent },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: baseAppChildren,
  },
  { path: 'unauthorized', component: UnauthorizedComponent },
  { path: '**', redirectTo: 'login' },
];
