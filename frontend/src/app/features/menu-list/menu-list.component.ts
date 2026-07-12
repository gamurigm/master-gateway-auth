import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { finalize, timeout } from "rxjs";
import { MenuService } from "../../core/menu.service";
import { Menu } from "../../core/api.models";
import { MenuFormComponent } from "../menu-form/menu-form.component";

@Component({
  selector: "app-menu-list",
  standalone: true,
  imports: [CommonModule, MenuFormComponent],
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Navegacion</span>
          <h1>Menus</h1>
          <p>Configura las entradas visibles de navegacion por modulo.</p>
        </div>
        <button class="primary-button compact-action" type="button" (click)="openCreate()">+ Nuevo menu</button>
      </header>

      <div class="admin-card">
        <div *ngIf="loading" class="list-state loading-state">
          <span class="state-spinner"></span>
          <strong>Cargando menus</strong>
          <small>Consultando menus activos...</small>
        </div>

        <div *ngIf="!loading && error" class="list-state error-state">
          <strong>No se pudo cargar menus</strong>
          <small>{{ error }}</small>
          <button class="secondary-button compact-action" type="button" (click)="loadMenus()">Reintentar</button>
        </div>

        <table *ngIf="!loading && !error" class="crud-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>URL</th>
              <th>Icono</th>
              <th>Orden</th>
              <th>Estado</th>
              <th class="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let menu of menus">
              <td><strong>{{ menu.name }}</strong></td>
              <td><code>{{ menu.url || '-' }}</code></td>
              <td>{{ menu.icon || '-' }}</td>
              <td>{{ menu.order }}</td>
              <td>
                <span class="badge" [class.badge-active]="menu.estado === 'ACTIVO'" [class.badge-inactive]="menu.estado === 'INACTIVO'">
                  {{ menu.estado }}
                </span>
              </td>
              <td class="td-actions">
                <button class="icon-btn edit" type="button" (click)="openEdit(menu)">Editar</button>
                <button class="icon-btn delete" type="button" (click)="confirmDelete(menu)">Eliminar</button>
              </td>
            </tr>
            <tr *ngIf="menus.length === 0">
              <td colspan="6">
                <div class="empty-state">
                  <strong>No hay menus registrados</strong>
                  <span>Crea entradas para que los roles tengan navegacion visible.</span>
                  <button class="primary-button compact-action" type="button" (click)="openCreate()">Crear menu</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <app-menu-form *ngIf="showForm" [menu]="selectedMenu" (closed)="closeForm()" (saved)="onSaved()" />
  `,
})
export class MenuListComponent implements OnInit {
  private readonly menuService = inject(MenuService);

  menus: Menu[] = [];
  loading = true;
  error = "";
  showForm = false;
  selectedMenu: Menu | null = null;

  ngOnInit() {
    this.loadMenus();
  }

  loadMenus() {
    this.loading = true;
    this.error = "";
    this.menuService
      .findAll()
      .pipe(
        timeout(6000),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (res) => {
          this.menus = Array.isArray(res) ? res : [];
        },
        error: () => {
          this.menus = [];
          this.error = "La consulta no respondio. Verifica la sesion o reintenta.";
        },
      });
  }

  openCreate() {
    this.selectedMenu = null;
    this.showForm = true;
  }

  openEdit(menu: Menu) {
    this.selectedMenu = menu;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.selectedMenu = null;
  }

  onSaved() {
    this.closeForm();
    this.loadMenus();
  }

  confirmDelete(menu: Menu) {
    if (confirm(`Eliminar menu "${menu.name}"?`)) {
      this.menuService.remove(menu.id).subscribe({
        next: () => this.loadMenus(),
        error: () => (this.error = "Error al eliminar menu"),
      });
    }
  }
}
