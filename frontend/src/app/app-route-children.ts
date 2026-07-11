import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RoleDetailComponent } from './features/role-detail/role-detail.component';

export const baseAppChildren: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'roles/:id', component: RoleDetailComponent },
];
