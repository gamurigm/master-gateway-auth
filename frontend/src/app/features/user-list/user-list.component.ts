import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { User } from '../../core/api.models';
import { UsersService } from '../../core/users.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, UserFormComponent, AppIconComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <div><p class="page-kicker">Identidades</p><h1>Usuarios</h1></div>
        <button class="primary-button" (click)="openCreate()"><app-icon name="lucidePlus" />Nuevo usuario</button>
      </header>

      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando usuarios...</div>
        <div *ngIf="error" class="error"><app-icon name="lucideCircleAlert" />{{ error }}</div>

        <table *ngIf="!loading" class="crud-table">
          <thead><tr><th>Email</th><th>Nombres</th><th>Apellidos</th><th>Estado</th><th class="th-actions">Acciones</th></tr></thead>
          <tbody>
            <tr *ngFor="let user of users">
              <td><strong>{{ user.email }}</strong></td>
              <td>{{ user.firstName }}</td>
              <td>{{ user.lastName }}</td>
              <td><span class="badge" [class.badge-active]="user.estado === 'ACTIVO'" [class.badge-inactive]="user.estado === 'INACTIVO'">{{ user.estado }}</span></td>
              <td class="td-actions">
                <button class="icon-btn edit" title="Editar" (click)="openEdit(user)"><app-icon name="lucidePencil" [size]="16" /></button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(user)"><app-icon name="lucideTrash2" [size]="16" /></button>
              </td>
            </tr>
            <tr *ngIf="users.length === 0"><td colspan="5" class="empty">No hay usuarios registrados</td></tr>
          </tbody>
        </table>

        <footer class="crud-footer" *ngIf="total > limit">
          <button class="icon-btn" title="Pagina anterior" [disabled]="page <= 1" (click)="changePage(page - 1)"><app-icon name="lucideChevronLeft" /></button>
          <span class="page-info">Pagina {{ page }} de {{ totalPages }}</span>
          <button class="icon-btn" title="Pagina siguiente" [disabled]="page >= totalPages" (click)="changePage(page + 1)"><app-icon name="lucideChevronRight" /></button>
        </footer>
      </div>
    </section>

    <app-user-form *ngIf="showForm" [user]="selectedUser" (closed)="closeForm()" (saved)="onSaved()" />
  `,
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
      next: (res) => { this.users = res.items; this.total = res.total; this.loading = false; },
      error: () => { this.error = 'Error al cargar usuarios'; this.loading = false; },
    });
  }

  changePage(page: number) { this.page = page; this.loadUsers(); }
  openCreate() { this.selectedUser = null; this.showForm = true; }
  openEdit(user: User) { this.selectedUser = user; this.showForm = true; }
  closeForm() { this.showForm = false; this.selectedUser = null; }
  onSaved() { this.closeForm(); this.loadUsers(); }

  confirmDelete(user: User) {
    if (confirm(`Eliminar usuario "${user.email}"?`)) {
      this.usersService.remove(user.id).subscribe({
        next: () => this.loadUsers(),
        error: () => this.error = 'Error al eliminar usuario',
      });
    }
  }
}
