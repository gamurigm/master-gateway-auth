import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { SystemModule } from '../../core/api.models';
import { ModulesService } from '../../core/modules.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import { ModuleFormComponent } from '../module-form/module-form.component';

@Component({
  selector: 'app-module-list',
  standalone: true,
  imports: [CommonModule, ModuleFormComponent, AppIconComponent],
  template: `
    <section class="crud-page">
      <header class="crud-header">
        <div><p class="page-kicker">Catalogo</p><h1>Modulos</h1></div>
        <button class="primary-button" (click)="openCreate()"><app-icon name="lucidePlus" />Nuevo modulo</button>
      </header>
      <div class="crud-card">
        <div *ngIf="loading" class="loading">Cargando modulos...</div>
        <div *ngIf="error" class="error"><app-icon name="lucideCircleAlert" />{{ error }}</div>
        <table *ngIf="!loading" class="crud-table">
          <thead><tr><th>Codigo</th><th>Nombre</th><th>Descripcion</th><th>Estado</th><th class="th-actions">Acciones</th></tr></thead>
          <tbody>
            <tr *ngFor="let module of modules">
              <td><code>{{ module.code }}</code></td>
              <td><strong>{{ module.name }}</strong></td>
              <td>{{ module.description || '-' }}</td>
              <td><span class="badge" [class.badge-active]="module.estado === 'ACTIVO'" [class.badge-inactive]="module.estado === 'INACTIVO'">{{ module.estado }}</span></td>
              <td class="td-actions">
                <button class="icon-btn edit" title="Editar" (click)="openEdit(module)"><app-icon name="lucidePencil" [size]="16" /></button>
                <button class="icon-btn delete" title="Eliminar" (click)="confirmDelete(module)"><app-icon name="lucideTrash2" [size]="16" /></button>
              </td>
            </tr>
            <tr *ngIf="modules.length === 0"><td colspan="5" class="empty">No hay modulos registrados</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <app-module-form *ngIf="showForm" [module]="selectedModule" (closed)="closeForm()" (saved)="onSaved()" />
  `,
})
export class ModuleListComponent implements OnInit {
  private readonly modulesService = inject(ModulesService);
  modules: SystemModule[] = [];
  loading = true;
  error = '';
  showForm = false;
  selectedModule: SystemModule | null = null;

  ngOnInit() { this.loadModules(); }
  private loadModules() {
    this.loading = true;
    this.error = '';
    this.modulesService.findAll().subscribe({
      next: (modules) => { this.modules = modules; this.loading = false; },
      error: () => { this.error = 'Error al cargar modulos'; this.loading = false; },
    });
  }
  openCreate() { this.selectedModule = null; this.showForm = true; }
  openEdit(module: SystemModule) { this.selectedModule = module; this.showForm = true; }
  closeForm() { this.showForm = false; this.selectedModule = null; }
  onSaved() { this.closeForm(); this.loadModules(); }
  confirmDelete(module: SystemModule) {
    if (confirm(`Eliminar modulo "${module.name}"?`)) {
      this.modulesService.remove(module.id).subscribe({
        next: () => this.loadModules(),
        error: () => this.error = 'Error al eliminar modulo',
      });
    }
  }
}
