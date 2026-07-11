import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RolesService } from '../../core/roles.service';
import { UsersService } from '../../core/users.service';
import { ModulesService } from '../../core/modules.service';
import { MenuService } from '../../core/menu.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import {
  RoleDetail,
  User,
  SystemModule,
  Menu,
} from '../../core/api.models';

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <section class="detail-page">
      <header class="detail-header">
        <div>
          <button class="back-btn" (click)="goBack()"><app-icon name="lucideArrowLeft" [size]="16" />Volver</button>
          <h1>Asignaciones: {{ role?.name }}</h1>
          <p *ngIf="role?.description">{{ role.description }}</p>
        </div>
      </header>

      <div *ngIf="loading" class="loading">Cargando...</div>
      <div *ngIf="error" class="error">{{ error }}</div>

      <div *ngIf="!loading && role" class="tabs">
        <button
          class="tab-btn"
          [class.active]="activeTab === 'users'"
          (click)="activeTab = 'users'"
        >
          Usuarios ({{ role.users.length }})
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab === 'modules'"
          (click)="activeTab = 'modules'"
        >
          Modulos ({{ role.modules.length }})
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab === 'menus'"
          (click)="activeTab = 'menus'"
        >
          Menus ({{ role.menus.length }})
        </button>
      </div>

      <div *ngIf="!loading && role" class="tab-content">
        <!-- USERS TAB -->
        <div *ngIf="activeTab === 'users'" class="assignment-section">
          <div class="assign-bar">
            <select [(ngModel)]="selectedUserId" class="assign-select">
              <option value="">-- Seleccionar usuario --</option>
              <option *ngFor="let u of availableUsers" [value]="u.id">
                {{ u.email }} ({{ u.firstName }}{{ u.lastName ? ' ' + u.lastName : '' }})
              </option>
            </select>
            <button
              class="primary-button"
              [disabled]="!selectedUserId || assigning"
              (click)="assignUser()"
            >
              <app-icon name="lucidePlus" />{{ assigning ? 'Asignando...' : 'Asignar' }}
            </button>
          </div>
          <div class="crud-card">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombres</th>
                  <th>Apellidos</th>
                  <th class="th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let ur of role.users">
                  <td>{{ ur.user.email }}</td>
                  <td>{{ ur.user.firstName }}</td>
                  <td>{{ ur.user.lastName || '-' }}</td>
                  <td class="td-actions">
                    <button
                      class="icon-btn delete"
                      title="Desasignar"
                      (click)="unassignUser(ur)"
                    ><app-icon name="lucideTrash2" [size]="16" /></button>
                  </td>
                </tr>
                <tr *ngIf="role.users.length === 0">
                  <td colspan="4" class="empty">No hay usuarios asignados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- MODULES TAB -->
        <div *ngIf="activeTab === 'modules'" class="assignment-section">
          <div class="assign-bar">
            <select [(ngModel)]="selectedModuleId" class="assign-select">
              <option value="">-- Seleccionar modulo --</option>
              <option *ngFor="let m of availableModules" [value]="m.id">
                {{ m.code }} - {{ m.name }}
              </option>
            </select>
            <button
              class="primary-button"
              [disabled]="!selectedModuleId || assigning"
              (click)="assignModule()"
            >
              <app-icon name="lucidePlus" />{{ assigning ? 'Asignando...' : 'Asignar' }}
            </button>
          </div>
          <div class="crud-card">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Descripcion</th>
                  <th class="th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let rm of role.modules">
                  <td>{{ rm.module.code }}</td>
                  <td>{{ rm.module.name }}</td>
                  <td>{{ rm.module.description || '-' }}</td>
                  <td class="td-actions">
                    <button
                      class="icon-btn delete"
                      title="Desasignar"
                      (click)="unassignModule(rm)"
                    ><app-icon name="lucideTrash2" [size]="16" /></button>
                  </td>
                </tr>
                <tr *ngIf="role.modules.length === 0">
                  <td colspan="4" class="empty">No hay modulos asignados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- MENUS TAB -->
        <div *ngIf="activeTab === 'menus'" class="assignment-section">
          <div class="assign-bar">
            <select [(ngModel)]="selectedMenuId" class="assign-select">
              <option value="">-- Seleccionar menu --</option>
              <option *ngFor="let m of availableMenus" [value]="m.id">
                {{ m.name }}{{ m.url ? ' (' + m.url + ')' : '' }}
              </option>
            </select>
            <button
              class="primary-button"
              [disabled]="!selectedMenuId || assigning"
              (click)="assignMenu()"
            >
              <app-icon name="lucidePlus" />{{ assigning ? 'Asignando...' : 'Asignar' }}
            </button>
          </div>
          <div class="crud-card">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>URL</th>
                  <th>Icono</th>
                  <th>Orden</th>
                  <th class="th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let rmenu of role.menus">
                  <td>{{ rmenu.menu.name }}</td>
                  <td>{{ rmenu.menu.url || '-' }}</td>
                  <td>{{ rmenu.menu.icon || '-' }}</td>
                  <td>{{ rmenu.menu.order }}</td>
                  <td class="td-actions">
                    <button
                      class="icon-btn delete"
                      title="Desasignar"
                      (click)="unassignMenu(rmenu)"
                    ><app-icon name="lucideTrash2" [size]="16" /></button>
                  </td>
                </tr>
                <tr *ngIf="role.menus.length === 0">
                  <td colspan="5" class="empty">No hay menus asignados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .detail-header { margin-bottom: 20px; }
    .detail-header h1 { margin: 10px 0 4px; font-size: 24px; letter-spacing: 0; }
    .detail-header p { margin: 0; color: var(--text-muted); font-size: 14px; }
    .back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0; color: var(--primary-color); background: none; border: 0; font-size: 14px; font-weight: 700; }
    .tabs { display: flex; gap: 4px; margin-bottom: 20px; overflow-x: auto; border-bottom: 1px solid var(--border); }
    .tab-btn { min-width: max-content; padding: 11px 16px; color: var(--text-muted); background: none; border: 0; border-bottom: 2px solid transparent; font-size: 14px; font-weight: 650; }
    .tab-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
    .assignment-section { display: grid; gap: 14px; }
    .assign-bar { display: flex; align-items: center; gap: 10px; }
    .assign-select { flex: 1; min-height: 40px; }
    @media (max-width: 620px) { .assign-bar { align-items: stretch; flex-direction: column; } }
  `],
})
export class RoleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly modulesService = inject(ModulesService);
  private readonly menuService = inject(MenuService);

  role: RoleDetail | null = null;
  loading = true;
  error = '';
  activeTab: 'users' | 'modules' | 'menus' = 'users';
  assigning = false;

  allUsers: User[] = [];
  allModules: SystemModule[] = [];
  allMenus: Menu[] = [];

  selectedUserId = '';
  selectedModuleId = '';
  selectedMenuId = '';

  get availableUsers(): User[] {
    if (!this.role) return [];
    const assigned = new Set(this.role.users.map((ur) => ur.user.id));
    return this.allUsers.filter((u) => !assigned.has(u.id));
  }

  get availableModules(): SystemModule[] {
    if (!this.role) return [];
    const assigned = new Set(this.role.modules.map((rm) => rm.module.id));
    return this.allModules.filter((m) => !assigned.has(m.id));
  }

  get availableMenus(): Menu[] {
    if (!this.role) return [];
    const assigned = new Set(this.role.menus.map((rmenu) => rmenu.menu.id));
    return this.allMenus.filter((m) => !assigned.has(m.id));
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadRole(id);
    this.loadAll();
  }

  goBack() {
    void this.router.navigate(['/app/roles']);
  }

  private loadRole(id: string) {
    this.loading = true;
    this.error = '';
    this.rolesService.findOne(id).subscribe({
      next: (role) => { this.role = role; this.loading = false; },
      error: () => { this.error = 'Error al cargar el rol'; this.loading = false; },
    });
  }

  private loadAll() {
    this.usersService.findAll(1, 200).subscribe({ next: (res) => (this.allUsers = res.items) });
    this.modulesService.findAll().subscribe({ next: (m) => (this.allModules = m) });
    this.menuService.findAll().subscribe({ next: (m) => (this.allMenus = m) });
  }

  assignUser() {
    if (!this.role || !this.selectedUserId) return;
    this.assigning = true;
    this.rolesService.assignUser(this.role.id, this.selectedUserId).subscribe({
      next: () => {
        this.selectedUserId = '';
        this.assigning = false;
        this.loadRole(this.role!.id);
      },
      error: (err) => { this.error = err.error?.message || 'Error al asignar usuario'; this.assigning = false; },
    });
  }

  unassignUser(ur: { id: string; user: { id: string } }) {
    if (!this.role) return;
    if (!confirm('¿Desasignar este usuario del rol?')) return;
    this.rolesService.unassignUser(this.role.id, ur.user.id).subscribe({
      next: () => this.loadRole(this.role!.id),
      error: () => (this.error = 'Error al desasignar usuario'),
    });
  }

  assignModule() {
    if (!this.role || !this.selectedModuleId) return;
    this.assigning = true;
    this.rolesService.assignModule(this.role.id, this.selectedModuleId).subscribe({
      next: () => {
        this.selectedModuleId = '';
        this.assigning = false;
        this.loadRole(this.role!.id);
      },
      error: (err) => { this.error = err.error?.message || 'Error al asignar modulo'; this.assigning = false; },
    });
  }

  unassignModule(rm: { id: string; module: { id: string } }) {
    if (!this.role) return;
    if (!confirm('¿Desasignar este modulo del rol?')) return;
    this.rolesService.unassignModule(this.role.id, rm.module.id).subscribe({
      next: () => this.loadRole(this.role!.id),
      error: () => (this.error = 'Error al desasignar modulo'),
    });
  }

  assignMenu() {
    if (!this.role || !this.selectedMenuId) return;
    this.assigning = true;
    this.rolesService.assignMenu(this.role.id, this.selectedMenuId).subscribe({
      next: () => {
        this.selectedMenuId = '';
        this.assigning = false;
        this.loadRole(this.role!.id);
      },
      error: (err) => { this.error = err.error?.message || 'Error al asignar menu'; this.assigning = false; },
    });
  }

  unassignMenu(rmenu: { id: string; menu: { id: string } }) {
    if (!this.role) return;
    if (!confirm('¿Desasignar este menu del rol?')) return;
    this.rolesService.unassignMenu(this.role.id, rmenu.menu.id).subscribe({
      next: () => this.loadRole(this.role!.id),
      error: () => (this.error = 'Error al desasignar menu'),
    });
  }
}
