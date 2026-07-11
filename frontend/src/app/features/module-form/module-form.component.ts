import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModulesService } from '../../core/modules.service';
import { SystemModule, CreateModuleDto, UpdateModuleDto } from '../../core/api.models';

@Component({
  selector: 'app-module-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-panel" (click)="$event.stopPropagation()">
        <h2>{{ isEdit ? 'Editar módulo' : 'Nuevo módulo' }}</h2>

        <div *ngIf="error" class="error">{{ error }}</div>

        <div class="field">
          <label>Código</label>
          <input type="text" [(ngModel)]="dto.code" placeholder="Ej: ADMIN" required />
        </div>
        <div class="field">
          <label>Nombre</label>
          <input type="text" [(ngModel)]="dto.name" placeholder="Ej: Administración" required />
        </div>
        <div class="field">
          <label>Descripción</label>
          <input type="text" [(ngModel)]="dto.description" placeholder="Descripción del módulo" />
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
      padding:32px;animation:slideUpFade 0.3s ease-out
    }
    .modal-panel h2 { margin:0 0 24px;font-size:20px;font-weight:700 }
    .modal-actions { display:flex;justify-content:flex-end;gap:12px;margin-top:24px }
  `]
})
export class ModuleFormComponent implements OnInit {
  private readonly modulesService = inject(ModulesService);

  @Input() module: SystemModule | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  isEdit = false;

  close() {
    this.closed.emit();
  }
  saving = false;
  error = '';
  dto: CreateModuleDto & Partial<UpdateModuleDto> = { code: '', name: '', description: '' };

  ngOnInit() {
    if (this.module) {
      this.isEdit = true;
      this.dto.code = this.module.code;
      this.dto.name = this.module.name;
      this.dto.description = this.module.description ?? '';
    }
  }

  submit() {
    if (!this.dto.code || !this.dto.name) return;
    this.saving = true;
    this.error = '';

    const obs = this.isEdit
      ? this.modulesService.update(this.module!.id, {
          code: this.dto.code || undefined,
          name: this.dto.name || undefined,
          description: this.dto.description || undefined,
        } as UpdateModuleDto)
      : this.modulesService.create(this.dto as CreateModuleDto);

    obs.subscribe({
      next: () => this.saved.emit(),
      error: (err) => {
        this.error = err.error?.message || 'Error al guardar módulo';
        this.saving = false;
      },
    });
  }
}
