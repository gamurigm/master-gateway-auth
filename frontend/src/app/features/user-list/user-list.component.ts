import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersService } from '../../core/users.service';
import { User } from '../../core/api.models';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, UserFormComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <h1>Usuarios</h1>
        <button class="primary-button" style="width:auto;padding:0 24px;height:40px;min-height:40px" (click)="openCreate()">+ Nuevo usuario</button>
      </header>

      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando...</div>

        <div *ngIf="error" class="error">{{ error }}</div>

        <table *ngIf="!loading" class="crud-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombres</th>
              <th>Apellidos</th>
              <th>Estado</th>
              <th class="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of users">
              <td>{{ user.email }}</td>
              <td>{{ user.firstName }}</td>
              <td>{{ user.lastName }}</td>
              <td>
                <span class="badge" [class.badge-active]="user.estado === 'ACTIVO'" [class.badge-inactive]="user.estado === 'INACTIVO'">
                  {{ user.estado }}
                </span>
              </td>
              <td class="td-actions">
                <button class="icon-btn edit" title="Editar" (click)="openEdit(user)">&#9998;</button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(user)">&#10005;</button>
              </td>
            </tr>
            <tr *ngIf="users.length === 0">
              <td colspan="5" class="empty">No hay usuarios registrados</td>
            </tr>
          </tbody>
        </table>

        <footer class="crud-footer" *ngIf="total > limit">
          <button class="secondary-button" style="width:auto;padding:0 16px;height:36px;min-height:36px;font-size:13px" [disabled]="page <= 1" (click)="changePage(page - 1)">Anterior</button>
          <span class="page-info">Página {{ page }} de {{ totalPages }}</span>
          <button class="secondary-button" style="width:auto;padding:0 16px;height:36px;min-height:36px;font-size:13px" [disabled]="page >= totalPages" (click)="changePage(page + 1)">Siguiente</button>
        </footer>
      </div>
    </section>

    <app-user-form
      *ngIf="showForm"
      [user]="selectedUser"
      (closed)="closeForm()"
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
    .th-actions,.td-actions { text-align:center;width:120px }
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
    .crud-footer { display:flex;align-items:center;justify-content:center;gap:16px;padding:16px 20px;border-top:1px solid #e2e8f0 }
    .page-info { font-size:13px;color:var(--text-muted);font-weight:500 }
  `]
})
export class UserListComponent implements OnInit {
  private readonly usersService = inject(UsersService);

  users: User[] = [];
  loading = true;
  error = '';
  page = 1;
  limit = 20;
  total = 0;
  showForm = false;
  selectedUser: User | null = null;

  get totalPages() { return Math.ceil(this.total / this.limit); }

  ngOnInit() { this.loadUsers(); }

  private loadUsers() {
    this.loading = true;
    this.error = '';
    this.usersService.findAll(this.page, this.limit).subscribe({
      next: (res) => {
        this.users = res.items;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar usuarios';
        this.loading = false;
      },
    });
  }

  changePage(p: number) { this.page = p; this.loadUsers(); }

  openCreate() { this.selectedUser = null; this.showForm = true; }

  openEdit(user: User) { this.selectedUser = user; this.showForm = true; }

  closeForm() { this.showForm = false; this.selectedUser = null; }

  onSaved() { this.closeForm(); this.loadUsers(); }

  confirmDelete(user: User) {
    if (confirm(`¿Eliminar usuario "${user.email}"?`)) {
      this.usersService.remove(user.id).subscribe({
        next: () => this.loadUsers(),
        error: () => this.error = 'Error al eliminar usuario',
      });
    }
  }
}
