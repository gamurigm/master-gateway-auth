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
    <div class="modal-backdrop" (click)="close()">
      <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
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
export class UserFormComponent implements OnInit {
  private readonly usersService = inject(UsersService);

  @Input() user: User | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  isEdit = false;

  close() {
    this.closed.emit();
  }
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
