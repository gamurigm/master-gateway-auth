import { Routes } from "@angular/router";
import { DashboardComponent } from "./features/dashboard/dashboard.component";
import { UserListComponent } from "./features/user-list/user-list.component";
import { RoleListComponent } from "./features/role-list/role-list.component";
import { ModuleListComponent } from "./features/module-list/module-list.component";
import { MenuListComponent } from "./features/menu-list/menu-list.component";
import { UserFormComponent } from "./features/user-form/user-form.component";
import { RoleFormComponent } from "./features/role-form/role-form.component";
import { ModuleFormComponent } from "./features/module-form/module-form.component";
import { MenuFormComponent } from "./features/menu-form/menu-form.component";

export const baseAppChildren: Routes = [
  { path: "", component: DashboardComponent },
  { path: "users", component: UserListComponent },
  { path: "users/new", component: UserFormComponent },
  { path: "users/:id", component: UserFormComponent },
  { path: "roles", component: RoleListComponent },
  { path: "roles/new", component: RoleFormComponent },
  { path: "roles/:id", component: RoleFormComponent },
  { path: "modules", component: ModuleListComponent },
  { path: "modules/new", component: ModuleFormComponent },
  { path: "modules/:id", component: ModuleFormComponent },
  { path: "menus", component: MenuListComponent },
  { path: "menus/new", component: MenuFormComponent },
  { path: "menus/:id", component: MenuFormComponent },
];
