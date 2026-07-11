import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RolesService } from '../../core/roles.service';
import { UsersService } from '../../core/users.service';
import { ModulesService } from '../../core/modules.service';
import { MenuService } from '../../core/menu.service';
import {
  RoleDetail,
  User,
  SystemModule,
  Menu,
} from '../../core/api.models';

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="detail-page">
      <header class="detail-header">
        <div>
          <button class="back-btn" (click)="goBack()">&#8592; Volver</button>
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
              style="width:auto;padding:0 20px;height:40px;min-height:40px"
              [disabled]="!selectedUserId || assigning"
              (click)="assignUser()"
            >
              {{ assigning ? 'Asignando...' : '+ Asignar' }}
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
                    >&#10005;</button>
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
              style="width:auto;padding:0 20px;height:40px;min-height:40px"
              [disabled]="!selectedModuleId || assigning"
              (click)="assignModule()"
            >
              {{ assigning ? 'Asignando...' : '+ Asignar' }}
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
                    >&#10005;</button>
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
              style="width:auto;padding:0 20px;height:40px;min-height:40px"
              [disabled]="!selectedMenuId || assigning"
              (click)="assignMenu()"
            >
              {{ assigning ? 'Asignando...' : '+ Asignar' }}
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
                    >&#10005;</button>
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
    .detail-page { animation: slideUpFade 0.4s ease-out; }
    .detail-header { margin-bottom: 24px }
    .detail-header h1 { margin: 8px 0 4px; font-size: 22px; font-weight: 800; letter-spacing: -0.3px }
    .detail-header p { margin: 0; color: var(--text-muted); font-size: 14px }
    .back-btn {
      background: none; border: none; color: var(--primary-color); font-weight: 600;
      font-size: 14px; cursor: pointer; padding: 0; display: inline-flex; align-items: center; gap: 4px
    }
    .back-btn:hover { text-decoration: underline }
    .loading { padding: 48px; text-align: center; color: var(--text-muted); font-weight: 500 }
    .tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 0 }
    .tab-btn {
      padding: 10px 20px; font-size: 14px; font-weight: 600; color: var(--text-muted);
      background: none; border: none; border-bottom: 2px solid transparent;
      margin-bottom: -2px; cursor: pointer; transition: all 0.2s
    }
    .tab-btn:hover { color: var(--text-main) }
    .tab-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color) }
    .assignment-section { display: grid; gap: 16px }
    .assign-bar { display: flex; gap: 12px; align-items: center }
    .assign-select {
      flex: 1; height: 40px; border: 2px solid #e2e8f0; border-radius: 10px;
      padding: 0 12px; font-size: 14px; background: #f8fafc; color: var(--text-main);
      cursor: pointer; transition: border-color 0.2s
    }
    .assign-select:focus { outline: none; border-color: var(--primary-color) }
    .crud-card {
      background: var(--glass-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: var(--glass-shadow); overflow: hidden
    }
    .crud-table { width: 100%; border-collapse: collapse }
    .crud-table th {
      text-align: left; padding: 14px 20px; font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);
      background: #f8fafc; border-bottom: 1px solid #e2e8f0
    }
    .crud-table td { padding: 14px 20px; font-size: 14px; border-bottom: 1px solid #f1f5f9; color: var(--text-main) }
    .crud-table tr:last-child td { border-bottom: 0 }
    .crud-table tr:hover td { background: #f8fafc }
    .th-actions, .td-actions { text-align: center; width: 100px }
    .td-actions { display: flex; gap: 8px; justify-content: center }
    .icon-btn { width: 32px; height: 32px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; transition: all 0.2s }
    .icon-btn.delete { background: #fef2f2; color: #dc2626 }
    .icon-btn.delete:hover { background: #fee2e2 }
    .empty { text-align: center; color: var(--text-muted); padding: 40px 20px !important; font-weight: 500 }
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
