import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesService } from '../../core/roles.service';
import { Role } from '../../core/api.models';
import { RoleFormComponent } from '../role-form/role-form.component';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, RoleFormComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <h1>Roles</h1>
        <button class="primary-button" style="width:auto;padding:0 24px;height:40px;min-height:40px" (click)="openCreate()">+ Nuevo rol</button>
      </header>

      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando...</div>
        <div *ngIf="error" class="error">{{ error }}</div>

        <table *ngIf="!loading" class="crud-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th class="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let role of roles">
              <td><strong>{{ role.name }}</strong></td>
              <td>{{ role.description || '-' }}</td>
              <td>
                <span class="badge" [class.badge-active]="role.estado === 'ACTIVO'" [class.badge-inactive]="role.estado === 'INACTIVO'">
                  {{ role.estado }}
                </span>
              </td>
              <td class="td-actions">
                <button class="icon-btn edit" title="Editar" (click)="openEdit(role)">&#9998;</button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(role)">&#10005;</button>
              </td>
            </tr>
            <tr *ngIf="roles.length === 0">
              <td colspan="4" class="empty">No hay roles registrados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <app-role-form
      *ngIf="showForm"
      [role]="selectedRole"
      (close)="closeForm()"
      (saved)="onSaved()"
    />
  `,
  styles: [`
    .crud-page { animation: slideUpFade 0.4s ease-out; }
    .crud-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:24px }
    .crud-header h1 { margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px }
    .crud-card {
      background:var(--glass-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      border:1px solid var(--glass-border);border-radius:16px;box-shadow:var(--glass-shadow);overflow:hidden
    }
    .loading { padding:48px;text-align:center;color:var(--text-muted);font-weight:500 }
    .crud-table { width:100%;border-collapse:collapse }
    .crud-table th { text-align:left;padding:14px 20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);background:#f8fafc;border-bottom:1px solid #e2e8f0 }
    .crud-table td { padding:14px 20px;font-size:14px;border-bottom:1px solid #f1f5f9;color:var(--text-main) }
    .crud-table tr:last-child td { border-bottom:0 }
    .crud-table tr:hover td { background:#f8fafc }
    .th-actions,.td-actions { text-align:center;width:100px }
    .td-actions { display:flex;gap:8px;justify-content:center }
    .badge { display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600 }
    .badge-active { background:#dcfce7;color:#166534 }
    .badge-inactive { background:#fef2f2;color:#991b1b }
    .icon-btn { width:32px;height:32px;border:0;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.2s }
    .icon-btn.edit { background:#eff6ff;color:#2563eb }
    .icon-btn.edit:hover { background:#dbeafe }
    .icon-btn.delete { background:#fef2f2;color:#dc2626 }
    .icon-btn.delete:hover { background:#fee2e2 }
    .empty { text-align:center;color:var(--text-muted);padding:40px 20px!important;font-weight:500 }
  `]
})
export class RoleListComponent implements OnInit {
  private readonly rolesService = inject(RolesService);

  roles: Role[] = [];
  loading = true;
  error = '';
  showForm = false;
  selectedRole: Role | null = null;

  ngOnInit() { this.loadRoles(); }

  private loadRoles() {
    this.loading = true;
    this.error = '';
    this.rolesService.findAll().subscribe({
      next: (res) => { this.roles = res; this.loading = false; },
      error: () => { this.error = 'Error al cargar roles'; this.loading = false; },
    });
  }

  openCreate() { this.selectedRole = null; this.showForm = true; }
  openEdit(role: Role) { this.selectedRole = role; this.showForm = true; }
  closeForm() { this.showForm = false; this.selectedRole = null; }
  onSaved() { this.closeForm(); this.loadRoles(); }

  confirmDelete(role: Role) {
    if (confirm(`¿Eliminar rol "${role.name}"?`)) {
      this.rolesService.remove(role.id).subscribe({
        next: () => this.loadRoles(),
        error: () => this.error = 'Error al eliminar rol',
      });
    }
  }
}
