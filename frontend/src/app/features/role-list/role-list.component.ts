import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { finalize, forkJoin, timeout } from "rxjs";
import { RolesService } from "../../core/roles.service";
import { Role, User, SystemModule, Menu, Permission } from "../../core/api.models";
import { RoleFormComponent } from "../role-form/role-form.component";
import { UsersService } from "../../core/users.service";
import { ModulesService } from "../../core/modules.service";
import { MenuService } from "../../core/menu.service";
import { PermissionsService } from "../../core/permissions.service";

@Component({
  selector: "app-role-list",
  standalone: true,
  imports: [CommonModule, RoleFormComponent],
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Permisos</span>
          <h1>Roles</h1>
          <p>Define perfiles de acceso y asigna usuarios, modulos, menus y permisos desde un solo lugar.</p>
        </div>
        <button class="primary-button compact-action" type="button" (click)="openCreate()">+ Nuevo rol</button>
      </header>

      <div class="admin-card">
        <div *ngIf="loading" class="list-state loading-state">
          <span class="state-spinner"></span>
          <strong>Cargando roles</strong>
          <small>Consultando roles activos...</small>
        </div>

        <div *ngIf="!loading && error" class="list-state error-state">
          <strong>No se pudo cargar roles</strong>
          <small>{{ error }}</small>
          <button class="secondary-button compact-action" type="button" (click)="loadRoles()">Reintentar</button>
        </div>

        <table *ngIf="!loading && !error" class="crud-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripcion</th>
              <th>Asignaciones</th>
              <th>Estado</th>
              <th class="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let role of roles">
              <td><strong>{{ role.name }}</strong></td>
              <td>{{ role.description || '-' }}</td>
              <td>
                <div class="assignment-summary">
                  <span>{{ role.users?.length || 0 }} usuarios</span>
                  <span>{{ role.modules?.length || 0 }} modulos</span>
                  <span>{{ role.menus?.length || 0 }} menus</span>
                  <span>{{ role.permissions?.length || 0 }} permisos</span>
                </div>
              </td>
              <td>
                <span class="badge" [class.badge-active]="role.estado === 'ACTIVO'" [class.badge-inactive]="role.estado === 'INACTIVO'">
                  {{ role.estado }}
                </span>
              </td>
              <td class="td-actions">
                <button class="icon-btn assign" type="button" (click)="openAssignments(role)">Permisos</button>
                <button class="icon-btn edit" type="button" (click)="openEdit(role)">Editar</button>
                <button class="icon-btn delete" type="button" (click)="confirmDelete(role)">Eliminar</button>
              </td>
            </tr>
            <tr *ngIf="roles.length === 0">
              <td colspan="5">
                <div class="empty-state">
                  <strong>No hay roles registrados</strong>
                  <span>Crea roles para organizar permisos de acceso.</span>
                  <button class="primary-button compact-action" type="button" (click)="openCreate()">Crear rol</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <app-role-form *ngIf="showForm" [role]="selectedRole" (closed)="closeForm()" (saved)="onSaved()" />

    <div *ngIf="assignmentRole" class="modal-overlay assignment-overlay" (click)="closeAssignments()">
      <div class="modal-panel assignment-panel" (click)="$event.stopPropagation()">
        <header class="assignment-header">
          <div>
            <span class="eyebrow">Asignaciones</span>
            <h2>{{ assignmentRole.name }}</h2>
            <p>Marca o desmarca los elementos que este rol puede usar.</p>
          </div>
          <button class="icon-btn" type="button" (click)="closeAssignments()">Cerrar</button>
        </header>

        <div *ngIf="assignmentLoading" class="list-state compact-state">
          <span class="state-spinner"></span>
          <strong>Cargando opciones</strong>
          <small>Consultando usuarios, modulos, menus y permisos disponibles...</small>
        </div>

        <div *ngIf="!assignmentLoading && assignmentError" class="error assignment-error">{{ assignmentError }}</div>

        <div *ngIf="!assignmentLoading" class="assignment-grid">
          <section class="assignment-section">
            <div class="assignment-section-title">
              <h3>Usuarios</h3>
              <span>{{ assignedUsersCount }} asignados</span>
            </div>

            <ng-container *ngIf="availableUsers.length; else noUsers">
              <label class="assignment-option" *ngFor="let user of availableUsers">
                <input
                  type="checkbox"
                  #userCheck
                  [checked]="isUserAssigned(user.id)"
                  [disabled]="isSaving('user:' + user.id)"
                  (change)="toggleUser(user.id, userCheck.checked)"
                />
                <span>
                  <strong>{{ displayUserName(user) }}</strong>
                  <small>{{ user.email }}</small>
                </span>
              </label>
            </ng-container>
            <ng-template #noUsers>
              <div class="mini-empty">No hay usuarios disponibles.</div>
            </ng-template>
          </section>

          <section class="assignment-section">
            <div class="assignment-section-title">
              <h3>Modulos</h3>
              <span>{{ assignedModulesCount }} asignados</span>
            </div>

            <ng-container *ngIf="availableModules.length; else noModules">
              <label class="assignment-option" *ngFor="let module of availableModules">
                <input
                  type="checkbox"
                  #moduleCheck
                  [checked]="isModuleAssigned(module.id)"
                  [disabled]="isSaving('module:' + module.id)"
                  (change)="toggleModule(module.id, moduleCheck.checked)"
                />
                <span>
                  <strong>{{ module.name }}</strong>
                  <small>{{ module.code }}</small>
                </span>
              </label>
            </ng-container>
            <ng-template #noModules>
              <div class="mini-empty">No hay modulos disponibles.</div>
            </ng-template>
          </section>

          <section class="assignment-section wide">
            <div class="assignment-section-title">
              <h3>Menus</h3>
              <span>{{ assignedMenusCount }} asignados</span>
            </div>

            <ng-container *ngIf="availableMenus.length; else noMenus">
              <label class="assignment-option" *ngFor="let menu of availableMenus">
                <input
                  type="checkbox"
                  #menuCheck
                  [checked]="isMenuAssigned(menu.id)"
                  [disabled]="isSaving('menu:' + menu.id)"
                  (change)="toggleMenu(menu.id, menuCheck.checked)"
                />
                <span>
                  <strong>{{ menu.name }}</strong>
                  <small>{{ menu.module?.name || 'Sin modulo' }} · {{ menu.url || 'Sin URL' }}</small>
                </span>
              </label>
            </ng-container>
            <ng-template #noMenus>
              <div class="mini-empty">No hay menus disponibles.</div>
            </ng-template>
          </section>

          <section class="assignment-section wide">
            <div class="assignment-section-title">
              <h3>Permisos</h3>
              <span>{{ assignedPermissionsCount }} asignados</span>
            </div>

            <ng-container *ngIf="availablePermissions.length; else noPermissions">
              <label class="assignment-option" *ngFor="let permission of availablePermissions">
                <input
                  type="checkbox"
                  #permissionCheck
                  [checked]="isPermissionAssigned(permission.id)"
                  [disabled]="isSaving('permission:' + permission.id)"
                  (change)="togglePermission(permission.id, permissionCheck.checked)"
                />
                <span>
                  <strong>{{ permission.description || permission.code }}</strong>
                  <small>{{ permission.code }} - {{ permission.delegable ? 'Delegable' : 'Solo superadmin' }}</small>
                </span>
              </label>
            </ng-container>
            <ng-template #noPermissions>
              <div class="mini-empty">No hay permisos disponibles.</div>
            </ng-template>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class RoleListComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly modulesService = inject(ModulesService);
  private readonly menuService = inject(MenuService);
  private readonly permissionsService = inject(PermissionsService);

  roles: Role[] = [];
  loading = true;
  error = "";
  showForm = false;
  selectedRole: Role | null = null;
  assignmentRole: Role | null = null;
  assignmentLoading = false;
  assignmentSaving = "";
  assignmentError = "";
  availableUsers: User[] = [];
  availableModules: SystemModule[] = [];
  availableMenus: Menu[] = [];
  availablePermissions: Permission[] = [];

  get assignedUsersCount() {
    return this.assignmentRole?.users?.length ?? 0;
  }

  get assignedModulesCount() {
    return this.assignmentRole?.modules?.length ?? 0;
  }

  get assignedMenusCount() {
    return this.assignmentRole?.menus?.length ?? 0;
  }

  get assignedPermissionsCount() {
    return this.assignmentRole?.permissions?.length ?? 0;
  }

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.loading = true;
    this.error = "";
    this.rolesService
      .findAll()
      .pipe(
        timeout(6000),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (res) => {
          this.roles = Array.isArray(res) ? res : [];
        },
        error: () => {
          this.roles = [];
          this.error = "La consulta no respondio. Verifica la sesion o reintenta.";
        },
      });
  }

  openCreate() {
    this.selectedRole = null;
    this.showForm = true;
  }

  openEdit(role: Role) {
    this.selectedRole = role;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.selectedRole = null;
  }

  onSaved() {
    this.closeForm();
    this.loadRoles();
  }

  openAssignments(role: Role) {
    this.assignmentRole = role;
    this.assignmentLoading = true;
    this.assignmentSaving = "";
    this.assignmentError = "";

    forkJoin({
      users: this.usersService.findAll(1, 100),
      modules: this.modulesService.findAll(),
      menus: this.menuService.findAll(),
      permissions: this.permissionsService.findAll(),
    })
      .pipe(
        timeout(6000),
        finalize(() => {
          this.assignmentLoading = false;
        }),
      )
      .subscribe({
        next: ({ users, modules, menus, permissions }) => {
          this.availableUsers = Array.isArray(users.items) ? users.items : [];
          this.availableModules = Array.isArray(modules) ? modules : [];
          this.availableMenus = Array.isArray(menus) ? menus : [];
          this.availablePermissions = Array.isArray(permissions) ? permissions : [];
        },
        error: () => {
          this.availableUsers = [];
          this.availableModules = [];
          this.availableMenus = [];
          this.availablePermissions = [];
          this.assignmentError = "No se pudieron cargar las opciones de asignacion.";
        },
      });
  }

  closeAssignments() {
    this.assignmentRole = null;
    this.assignmentLoading = false;
    this.assignmentSaving = "";
    this.assignmentError = "";
    this.availablePermissions = [];
  }

  isUserAssigned(userId: string) {
    return Boolean(this.assignmentRole?.users?.some((item) => item.estado === "ACTIVO" && item.user.id === userId));
  }

  isModuleAssigned(moduleId: string) {
    return Boolean(this.assignmentRole?.modules?.some((item) => item.estado === "ACTIVO" && item.module.id === moduleId));
  }

  isMenuAssigned(menuId: string) {
    return Boolean(this.assignmentRole?.menus?.some((item) => item.estado === "ACTIVO" && item.menu.id === menuId));
  }

  isPermissionAssigned(permissionId: string) {
    return Boolean(
      this.assignmentRole?.permissions?.some(
        (item) => item.estado === "ACTIVO" && item.permission.id === permissionId,
      ),
    );
  }

  isSaving(key: string) {
    return this.assignmentSaving === key;
  }

  toggleUser(userId: string, checked: boolean) {
    const role = this.assignmentRole;
    if (!role || this.assignmentSaving) return;

    this.assignmentSaving = `user:${userId}`;
    this.assignmentError = "";
    const request = checked
      ? this.rolesService.assignUser(role.id, userId)
      : this.rolesService.unassignUser(role.id, userId);

    request.pipe(timeout(6000)).subscribe({
      next: () => this.reloadRoleSnapshot(role.id),
      error: (err) => {
        this.assignmentError = this.readAssignmentError(err);
        this.assignmentSaving = "";
      },
    });
  }

  toggleModule(moduleId: string, checked: boolean) {
    const role = this.assignmentRole;
    if (!role || this.assignmentSaving) return;

    this.assignmentSaving = `module:${moduleId}`;
    this.assignmentError = "";
    const request = checked
      ? this.rolesService.assignModule(role.id, moduleId)
      : this.rolesService.unassignModule(role.id, moduleId);

    request.pipe(timeout(6000)).subscribe({
      next: () => this.reloadRoleSnapshot(role.id),
      error: (err) => {
        this.assignmentError = this.readAssignmentError(err);
        this.assignmentSaving = "";
      },
    });
  }

  toggleMenu(menuId: string, checked: boolean) {
    const role = this.assignmentRole;
    if (!role || this.assignmentSaving) return;

    this.assignmentSaving = `menu:${menuId}`;
    this.assignmentError = "";
    const request = checked
      ? this.rolesService.assignMenu(role.id, menuId)
      : this.rolesService.unassignMenu(role.id, menuId);

    request.pipe(timeout(6000)).subscribe({
      next: () => this.reloadRoleSnapshot(role.id),
      error: (err) => {
        this.assignmentError = this.readAssignmentError(err);
        this.assignmentSaving = "";
      },
    });
  }

  togglePermission(permissionId: string, checked: boolean) {
    const role = this.assignmentRole;
    if (!role || this.assignmentSaving) return;

    this.assignmentSaving = `permission:${permissionId}`;
    this.assignmentError = "";
    const request = checked
      ? this.rolesService.assignPermission(role.id, permissionId)
      : this.rolesService.unassignPermission(role.id, permissionId);

    request.pipe(timeout(6000)).subscribe({
      next: () => this.reloadRoleSnapshot(role.id),
      error: (err) => {
        this.assignmentError = this.readAssignmentError(err);
        this.assignmentSaving = "";
      },
    });
  }

  displayUserName(user: User) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return fullName || user.email;
  }

  confirmDelete(role: Role) {
    if (confirm(`Eliminar rol "${role.name}"?`)) {
      this.rolesService.remove(role.id).subscribe({
        next: () => this.loadRoles(),
        error: () => (this.error = "Error al eliminar rol"),
      });
    }
  }

  private reloadRoleSnapshot(roleId: string) {
    this.rolesService
      .findAll()
      .pipe(
        timeout(6000),
        finalize(() => {
          this.assignmentSaving = "";
        }),
      )
      .subscribe({
        next: (roles) => {
          this.roles = Array.isArray(roles) ? roles : [];
          const updatedRole = this.roles.find((role) => role.id === roleId);
          if (updatedRole) {
            this.assignmentRole = updatedRole;
          }
        },
        error: () => {
          this.assignmentError = "Se actualizo la asignacion, pero no se pudo refrescar el estado.";
        },
      });
  }

  private readAssignmentError(err: unknown) {
    const response = err as { error?: { message?: string | string[] } };
    const message = response.error?.message;
    if (Array.isArray(message)) return message.join(", ");
    return message || "No se pudo actualizar la asignacion.";
  }
}
