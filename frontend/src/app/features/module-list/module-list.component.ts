import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { finalize, timeout } from "rxjs";
import { ModulesService } from "../../core/modules.service";
import { SystemModule } from "../../core/api.models";
import { ModuleFormComponent } from "../module-form/module-form.component";

@Component({
  selector: "app-module-list",
  standalone: true,
  imports: [CommonModule, ModuleFormComponent],
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Arquitectura</span>
          <h1>Modulos</h1>
          <p>Administra las areas funcionales disponibles en el sistema.</p>
        </div>
        <button class="primary-button compact-action" type="button" (click)="openCreate()">+ Nuevo modulo</button>
      </header>

      <div class="admin-card">
        <div *ngIf="loading" class="list-state loading-state">
          <span class="state-spinner"></span>
          <strong>Cargando modulos</strong>
          <small>Consultando modulos activos...</small>
        </div>

        <div *ngIf="!loading && error" class="list-state error-state">
          <strong>No se pudo cargar modulos</strong>
          <small>{{ error }}</small>
          <button class="secondary-button compact-action" type="button" (click)="loadModules()">Reintentar</button>
        </div>

        <table *ngIf="!loading && !error" class="crud-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Nombre</th>
              <th>Descripcion</th>
              <th>Estado</th>
              <th class="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let mod of modules">
              <td><code>{{ mod.code }}</code></td>
              <td><strong>{{ mod.name }}</strong></td>
              <td>{{ mod.description || '-' }}</td>
              <td>
                <span class="badge" [class.badge-active]="mod.estado === 'ACTIVO'" [class.badge-inactive]="mod.estado === 'INACTIVO'">
                  {{ mod.estado }}
                </span>
              </td>
              <td class="td-actions">
                <button class="icon-btn edit" type="button" (click)="openEdit(mod)">Editar</button>
                <button class="icon-btn delete" type="button" (click)="confirmDelete(mod)">Eliminar</button>
              </td>
            </tr>
            <tr *ngIf="modules.length === 0">
              <td colspan="5">
                <div class="empty-state">
                  <strong>No hay modulos registrados</strong>
                  <span>Crea un modulo antes de configurar menus y permisos.</span>
                  <button class="primary-button compact-action" type="button" (click)="openCreate()">Crear modulo</button>
                </div>
              </td>
            </tr>
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
  error = "";
  showForm = false;
  selectedModule: SystemModule | null = null;

  ngOnInit() {
    this.loadModules();
  }

  loadModules() {
    this.loading = true;
    this.error = "";
    this.modulesService
      .findAll()
      .pipe(
        timeout(6000),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (res) => {
          this.modules = Array.isArray(res) ? res : [];
        },
        error: () => {
          this.modules = [];
          this.error = "La consulta no respondio. Verifica la sesion o reintenta.";
        },
      });
  }

  openCreate() {
    this.selectedModule = null;
    this.showForm = true;
  }

  openEdit(mod: SystemModule) {
    this.selectedModule = mod;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.selectedModule = null;
  }

  onSaved() {
    this.closeForm();
    this.loadModules();
  }

  confirmDelete(mod: SystemModule) {
    if (confirm(`Eliminar modulo "${mod.name}"?`)) {
      this.modulesService.remove(mod.id).subscribe({
        next: () => this.loadModules(),
        error: () => (this.error = "Error al eliminar modulo"),
      });
    }
  }
}
