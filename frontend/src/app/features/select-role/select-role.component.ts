import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleSummary } from '../../core/api.models';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>Espacio de trabajo</h1>
        <p>Selecciona el rol con el que operaras en esta sesion.</p>

        <div class="error" *ngIf="error">{{ error }}</div>

        <button
          class="role-option"
          type="button"
          *ngFor="let role of roles"
          (click)="select(role.id)"
          [disabled]="loading"
        >
          <strong>{{ role.name }}</strong>
          <span>{{ role.description || 'Sin descripcion' }}</span>
        </button>
      </section>
    </main>
  `,
  styles: [
    `
      .role-option {
        width: 100%;
        display: grid;
        gap: 6px;
        text-align: left;
        border: 2px solid transparent;
        border-radius: 12px;
        padding: 18px 20px;
        margin-bottom: 16px;
        background: #f8fafc;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
        overflow: hidden;
      }

      .role-option::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        border-radius: 10px;
        border: 2px solid transparent;
        transition: all 0.3s;
      }

      .role-option:hover:not(:disabled) {
        transform: translateY(-4px) scale(1.02);
        background: #ffffff;
        box-shadow: 0 12px 24px -4px rgba(59, 130, 246, 0.15);
        border-color: var(--primary-color);
      }

      .role-option:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
      }

      .role-option strong {
        font-size: 16px;  
        color: var(--text-main);
      }

      .role-option span {
        font-size: 14px;
        color: var(--text-muted);
      }

      .role-option:disabled {
        opacity: 0.5;
        cursor: wait;
      }
    `,
  ],
})
export class SelectRoleComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  roles: RoleSummary[] = [];
  loading = false;
  error = '';

  ngOnInit() {
    if (!this.authService.hasTempToken()) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.roles = this.authService.getRolesFromLogin();
    if (this.roles.length === 0) {
      this.error = 'El usuario no tiene roles activos asignados.';
    }
  }

  select(roleId: string) {
    this.loading = true;
    this.error = '';

    this.authService.selectRole(roleId).subscribe({
      next: () => {
        this.loading = false;
        void this.router.navigateByUrl('/app');
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo activar el rol seleccionado.';
      },
    });
  }
}

