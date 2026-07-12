import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { finalize, timeout } from "rxjs";
import { UsersService } from "../../core/users.service";
import { User } from "../../core/api.models";
import { UserFormComponent } from "../user-form/user-form.component";

@Component({
  selector: "app-user-list",
  standalone: true,
  imports: [CommonModule, UserFormComponent],
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Identidad</span>
          <h1>Usuarios</h1>
          <p>Administra cuentas, estado y acceso inicial al sistema.</p>
        </div>
        <button class="primary-button compact-action" type="button" (click)="openCreate()">
          + Nuevo usuario
        </button>
      </header>

      <div class="admin-card">
        <div *ngIf="loading" class="list-state loading-state">
          <span class="state-spinner"></span>
          <strong>Cargando usuarios</strong>
          <small>Consultando usuarios activos...</small>
        </div>

        <div *ngIf="!loading && error" class="list-state error-state">
          <strong>No se pudo cargar usuarios</strong>
          <small>{{ error }}</small>
          <button class="secondary-button compact-action" type="button" (click)="loadUsers()">Reintentar</button>
        </div>

        <table *ngIf="!loading && !error" class="crud-table">
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
              <td><strong>{{ user.email }}</strong></td>
              <td>{{ user.firstName || '-' }}</td>
              <td>{{ user.lastName || '-' }}</td>
              <td>
                <span class="badge" [class.badge-active]="user.estado === 'ACTIVO'" [class.badge-inactive]="user.estado === 'INACTIVO'">
                  {{ user.estado }}
                </span>
              </td>
              <td class="td-actions">
                <button class="icon-btn edit" type="button" title="Editar" (click)="openEdit(user)">Editar</button>
                <button class="icon-btn delete" type="button" title="Eliminar" (click)="confirmDelete(user)">Eliminar</button>
              </td>
            </tr>
            <tr *ngIf="users.length === 0">
              <td colspan="5">
                <div class="empty-state">
                  <strong>No hay usuarios registrados</strong>
                  <span>Crea el primer usuario para empezar a asignar accesos.</span>
                  <button class="primary-button compact-action" type="button" (click)="openCreate()">Crear usuario</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <footer class="crud-footer" *ngIf="!loading && !error && total > limit">
          <button class="secondary-button compact-action" type="button" [disabled]="page <= 1" (click)="changePage(page - 1)">Anterior</button>
          <span class="page-info">Pagina {{ page }} de {{ totalPages }}</span>
          <button class="secondary-button compact-action" type="button" [disabled]="page >= totalPages" (click)="changePage(page + 1)">Siguiente</button>
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
  error = "";
  page = 1;
  limit = 20;
  total = 0;
  showForm = false;
  selectedUser: User | null = null;

  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.error = "";
    this.usersService
      .findAll(this.page, this.limit)
      .pipe(
        timeout(6000),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (res) => {
          this.users = Array.isArray(res?.items) ? res.items : [];
          this.total = typeof res?.total === "number" ? res.total : this.users.length;
        },
        error: () => {
          this.users = [];
          this.total = 0;
          this.error = "La consulta no respondio. Verifica la sesion o reintenta.";
        },
      });
  }

  changePage(p: number) {
    this.page = p;
    this.loadUsers();
  }

  openCreate() {
    this.selectedUser = null;
    this.showForm = true;
  }

  openEdit(user: User) {
    this.selectedUser = user;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.selectedUser = null;
  }

  onSaved() {
    this.closeForm();
    this.loadUsers();
  }

  confirmDelete(user: User) {
    if (confirm(`Eliminar usuario "${user.email}"?`)) {
      this.usersService.remove(user.id).subscribe({
        next: () => this.loadUsers(),
        error: () => (this.error = "Error al eliminar usuario"),
      });
    }
  }
}
