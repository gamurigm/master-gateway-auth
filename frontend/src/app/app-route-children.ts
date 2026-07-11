import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const baseAppChildren: Routes = [
  { path: '', component: DashboardComponent },
];
