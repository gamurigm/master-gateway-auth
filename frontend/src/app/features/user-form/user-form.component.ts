import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../core/users.service';
import { User, CreateUserDto, UpdateUserDto } from '../../core/api.models';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-panel" (click)="$event.stopPropagation()">
        <h2>{{ isEdit ? 'Editar usuario' : 'Nuevo usuario' }}</h2>

        <div *ngIf="error" class="error">{{ error }}</div>

        <div class="field">
          <label>Email</label>
          <input type="email" [(ngModel)]="dto.email" placeholder="correo@ejemplo.com" required />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input type="password" [(ngModel)]="dto.password" placeholder="Mín. 8 caracteres" [required]="!isEdit" />
        </div>
        <div class="field">
          <label>Nombres</label>
          <input type="text" [(ngModel)]="dto.firstName" placeholder="Nombres" required />
        </div>
        <div class="field">
          <label>Apellidos</label>
          <input type="text" [(ngModel)]="dto.lastName" placeholder="Apellidos" />
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
export class UserFormComponent implements OnInit {
  private readonly usersService = inject(UsersService);

  @Input() user: User | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  isEdit = false;
  saving = false;
  error = '';
  dto: CreateUserDto & Partial<UpdateUserDto> = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  };

  ngOnInit() {
    if (this.user) {
      this.isEdit = true;
      this.dto.email = this.user.email;
      this.dto.firstName = this.user.firstName;
      this.dto.lastName = this.user.lastName ?? '';
      this.dto.password = '';
    }
  }

  submit() {
    if (!this.dto.email || !this.dto.firstName || (!this.isEdit && !this.dto.password)) return;

    this.saving = true;
    this.error = '';

    const obs = this.isEdit
      ? this.usersService.update(this.user!.id, {
          email: this.dto.email || undefined,
          firstName: this.dto.firstName || undefined,
          lastName: this.dto.lastName || undefined,
          password: this.dto.password || undefined,
        } as UpdateUserDto)
      : this.usersService.create(this.dto as CreateUserDto);

    obs.subscribe({
      next: () => this.saved.emit(),
      error: (err) => {
        this.error = err.error?.message || 'Error al guardar usuario';
        this.saving = false;
      },
    });
  }
}
