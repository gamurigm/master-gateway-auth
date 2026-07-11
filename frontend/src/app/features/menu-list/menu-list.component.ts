import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../core/menu.service';
import { Menu } from '../../core/api.models';
import { MenuFormComponent } from '../menu-form/menu-form.component';

@Component({
  selector: 'app-menu-list',
  standalone: true,
  imports: [CommonModule, MenuFormComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <h1>Menús</h1>
        <button class="primary-button" style="width:auto;padding:0 24px;height:40px;min-height:40px" (click)="openCreate()">+ Nuevo menú</button>
      </header>

      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando...</div>
        <div *ngIf="error" class="error">{{ error }}</div>

        <table *ngIf="!loading" class="crud-table">
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
                <button class="icon-btn edit" title="Editar" (click)="openEdit(menu)">&#9998;</button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(menu)">&#10005;</button>
              </td>
            </tr>
            <tr *ngIf="menus.length === 0">
              <td colspan="6" class="empty">No hay menús registrados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <app-menu-form
      *ngIf="showForm"
      [menu]="selectedMenu"
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
    code { background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px }
  `]
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
      next: (res) => { this.menus = res; this.loading = false; },
      error: () => { this.error = 'Error al cargar menús'; this.loading = false; },
    });
  }

  openCreate() { this.selectedMenu = null; this.showForm = true; }
  openEdit(menu: Menu) { this.selectedMenu = menu; this.showForm = true; }
  closeForm() { this.showForm = false; this.selectedMenu = null; }
  onSaved() { this.closeForm(); this.loadMenus(); }

  confirmDelete(menu: Menu) {
    if (confirm(`¿Eliminar menú "${menu.name}"?`)) {
      this.menuService.remove(menu.id).subscribe({
        next: () => this.loadMenus(),
        error: () => this.error = 'Error al eliminar menú',
      });
    }
  }
}
