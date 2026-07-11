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
    <div class="modal-backdrop" (click)="close()">
      <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
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
