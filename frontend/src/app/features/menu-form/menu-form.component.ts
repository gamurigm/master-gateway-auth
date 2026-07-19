import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../core/menu.service';
import { ModulesService } from '../../core/modules.service';
import { Menu, CreateMenuDto, UpdateMenuDto, SystemModule } from '../../core/api.models';

@Component({
  selector: 'app-menu-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <h2>{{ isEdit ? 'Editar menú' : 'Nuevo menú' }}</h2>

        <div *ngIf="error" class="error">{{ error }}</div>

        <div class="field">
          <label>Nombre</label>
          <input type="text" [(ngModel)]="dto.name" placeholder="Ej: Usuarios" required />
        </div>
        <div class="field">
          <label>Ruta (URL)</label>
          <input type="text" [(ngModel)]="dto.url" placeholder="Ej: /app/users" />
        </div>
        <div class="field">
          <label>Icono</label>
          <input type="text" [(ngModel)]="dto.icon" placeholder="Ej: users, settings" />
        </div>
        <div class="field">
          <label>Orden</label>
          <input type="number" [(ngModel)]="dto.order" placeholder="0" min="0" />
        </div>
        <div class="field">
          <label>Módulo</label>
          <select [(ngModel)]="dto.moduleId" required>
            <option value="">-- Seleccionar módulo --</option>
            <option *ngFor="let mod of modules" [value]="mod.id">{{ mod.name }} ({{ mod.code }})</option>
          </select>
        </div>
        <div class="field">
          <label>Menú padre (opcional)</label>
          <select [(ngModel)]="dto.parentId">
            <option [value]="undefined">-- Sin padre --</option>
            <option *ngFor="let m of allMenus" [value]="m.id">{{ m.name }}</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="secondary-button" (click)="close()">Cancelar</button>
          <button class="primary-button" [disabled]="saving" (click)="submit()">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class MenuFormComponent implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly modulesService = inject(ModulesService);

  @Input() menu: Menu | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  isEdit = false;

  close() {
    this.closed.emit();
  }
  saving = false;
  error = '';
  modules: SystemModule[] = [];
  allMenus: Menu[] = [];

  dto: CreateMenuDto & Partial<UpdateMenuDto> & { order: number | null; parentId: string | undefined } = {
    name: '',
    url: '',
    icon: '',
    order: 0,
    moduleId: '',
    parentId: undefined,
  };

  ngOnInit() {
    this.modulesService.findAll().subscribe({
      next: (res) => this.modules = res,
    });
    this.menuService.findAll().subscribe({
      next: (res) => this.allMenus = res,
    });

    if (this.menu) {
      this.isEdit = true;
      this.dto.name = this.menu.name;
      this.dto.url = this.menu.url ?? '';
      this.dto.icon = this.menu.icon ?? '';
      this.dto.order = this.menu.order;
      this.dto.moduleId = this.menu.moduleId;
      this.dto.parentId = this.menu.parentId ?? undefined;
    }
  }

  submit() {
    if (!this.dto.name || !this.dto.moduleId) return;
    this.saving = true;
    this.error = '';

    const payload = {
      name: this.dto.name,
      url: this.dto.url || undefined,
      icon: this.dto.icon || undefined,
      order: this.dto.order ?? undefined,
      moduleId: this.dto.moduleId,
      parentId: this.dto.parentId || undefined,
    };

    const obs = this.isEdit
      ? this.menuService.update(this.menu!.id, payload as UpdateMenuDto)
      : this.menuService.create(payload as CreateMenuDto);

    obs.subscribe({
      next: () => this.saved.emit(),
      error: (err) => {
        this.error = err.error?.message || 'Error al guardar menú';
        this.saving = false;
      },
    });
  }
}
