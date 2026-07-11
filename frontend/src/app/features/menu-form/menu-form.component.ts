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
    <div class="modal-overlay" (click)="close()">
      <div class="modal-panel" (click)="$event.stopPropagation()">
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
          <button class="secondary-button" style="width:auto;padding:0 24px;height:40px;min-height:40px" (click)="close()">Cancelar</button>
          <button class="primary-button" style="width:auto;padding:0 24px;height:40px;min-height:40px" [disabled]="saving" (click)="submit()">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);
      display:grid;place-items:center;z-index:1000;animation:slideUpFade 0.2s ease-out;
      padding:24px
    }
    .modal-panel {
      width:min(100%,500px);
      background:var(--glass-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      border:1px solid var(--glass-border);border-radius:16px;box-shadow:var(--glass-shadow);
      padding:32px;animation:slideUpFade 0.3s ease-out;
      max-height:90vh;overflow-y:auto
    }
    .modal-panel h2 { margin:0 0 24px;font-size:20px;font-weight:700 }
    .modal-actions { display:flex;justify-content:flex-end;gap:12px;margin-top:24px }
    select { width:100%;border:2px solid transparent;background:#f8fafc;border-radius:10px;padding:14px 16px;transition:all 0.3s ease;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);font:inherit }
    select:focus { outline:none;background:#ffffff;border-color:var(--primary-color);box-shadow:0 0 0 4px rgba(59,130,246,0.15) }
  `]
})
export class MenuFormComponent implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly modulesService = inject(ModulesService);

  @Input() menu: Menu | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  isEdit = false;
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
