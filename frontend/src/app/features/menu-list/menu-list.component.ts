import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Menu } from '../../core/api.models';
import { MenuService } from '../../core/menu.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import { MenuFormComponent } from '../menu-form/menu-form.component';

@Component({
  selector: 'app-menu-list',
  standalone: true,
  imports: [CommonModule, MenuFormComponent, AppIconComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <div><p class="page-kicker">Navegacion</p><h1>Menus</h1></div>
        <button class="primary-button" (click)="openCreate()"><app-icon name="lucidePlus" />Nuevo menu</button>
      </header>
      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando menus...</div>
        <div *ngIf="error" class="error"><app-icon name="lucideCircleAlert" />{{ error }}</div>
        <table *ngIf="!loading" class="crud-table">
          <thead><tr><th>Nombre</th><th>URL</th><th>Icono</th><th>Orden</th><th>Estado</th><th class="th-actions">Acciones</th></tr></thead>
          <tbody>
            <tr *ngFor="let menu of menus">
              <td><strong>{{ menu.name }}</strong></td>
              <td><code>{{ menu.url || '-' }}</code></td>
              <td>{{ menu.icon || '-' }}</td>
              <td>{{ menu.order }}</td>
              <td><span class="badge" [class.badge-active]="menu.estado === 'ACTIVO'" [class.badge-inactive]="menu.estado === 'INACTIVO'">{{ menu.estado }}</span></td>
              <td class="td-actions">
                <button class="icon-btn edit" title="Editar" (click)="openEdit(menu)"><app-icon name="lucidePencil" [size]="16" /></button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(menu)"><app-icon name="lucideTrash2" [size]="16" /></button>
              </td>
            </tr>
            <tr *ngIf="menus.length === 0"><td colspan="6" class="empty">No hay menus registrados</td></tr>
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
  error = '';
  showForm = false;
  selectedMenu: Menu | null = null;

  ngOnInit() { this.loadMenus(); }
  private loadMenus() {
    this.loading = true;
    this.error = '';
    this.menuService.findAll().subscribe({
      next: (menus) => { this.menus = menus; this.loading = false; },
      error: () => { this.error = 'Error al cargar menus'; this.loading = false; },
    });
  }
  openCreate() { this.selectedMenu = null; this.showForm = true; }
  openEdit(menu: Menu) { this.selectedMenu = menu; this.showForm = true; }
  closeForm() { this.showForm = false; this.selectedMenu = null; }
  onSaved() { this.closeForm(); this.loadMenus(); }
  confirmDelete(menu: Menu) {
    if (confirm(`Eliminar menu "${menu.name}"?`)) {
      this.menuService.remove(menu.id).subscribe({
        next: () => this.loadMenus(),
        error: () => this.error = 'Error al eliminar menu',
      });
    }
  }
}
