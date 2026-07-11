import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Role } from '../../core/api.models';
import { RolesService } from '../../core/roles.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import { RoleFormComponent } from '../role-form/role-form.component';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, RoleFormComponent, AppIconComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <div><p class="page-kicker">Autorizacion</p><h1>Roles</h1></div>
        <button class="primary-button" (click)="openCreate()"><app-icon name="lucidePlus" />Nuevo rol</button>
      </header>
      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando roles...</div>
        <div *ngIf="error" class="error"><app-icon name="lucideCircleAlert" />{{ error }}</div>
        <table *ngIf="!loading" class="crud-table">
          <thead><tr><th>Nombre</th><th>Descripcion</th><th>Estado</th><th class="th-actions">Acciones</th></tr></thead>
          <tbody>
            <tr *ngFor="let role of roles">
              <td><strong>{{ role.name }}</strong></td>
              <td>{{ role.description || '-' }}</td>
              <td><span class="badge" [class.badge-active]="role.estado === 'ACTIVO'" [class.badge-inactive]="role.estado === 'INACTIVO'">{{ role.estado }}</span></td>
              <td class="td-actions">
                <button class="icon-btn assign" title="Asignaciones" (click)="goToAssignments(role)"><app-icon name="lucideSettings" [size]="16" /></button>
                <button class="icon-btn edit" title="Editar" (click)="openEdit(role)"><app-icon name="lucidePencil" [size]="16" /></button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(role)"><app-icon name="lucideTrash2" [size]="16" /></button>
              </td>
            </tr>
            <tr *ngIf="roles.length === 0"><td colspan="4" class="empty">No hay roles registrados</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <app-role-form *ngIf="showForm" [role]="selectedRole" (closed)="closeForm()" (saved)="onSaved()" />
  `,
})
export class RoleListComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly router = inject(Router);
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
      next: (roles) => { this.roles = roles; this.loading = false; },
      error: () => { this.error = 'Error al cargar roles'; this.loading = false; },
    });
  }
  openCreate() { this.selectedRole = null; this.showForm = true; }
  openEdit(role: Role) { this.selectedRole = role; this.showForm = true; }
  closeForm() { this.showForm = false; this.selectedRole = null; }
  onSaved() { this.closeForm(); this.loadRoles(); }
  goToAssignments(role: Role) { void this.router.navigate(['/app/roles', role.id]); }
  confirmDelete(role: Role) {
    if (confirm(`Eliminar rol "${role.name}"?`)) {
      this.rolesService.remove(role.id).subscribe({
        next: () => this.loadRoles(),
        error: () => this.error = 'Error al eliminar rol',
      });
    }
  }
}
