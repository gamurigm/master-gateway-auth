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
        gap: 4px;
        text-align: left;
        border: 1px solid #c8d0df;
        border-radius: 6px;
        padding: 14px 16px;
        margin-bottom: 12px;
        background: #ffffff;
      }

      .role-option:hover {
        border-color: #1662d4;
        background: #f4f8ff;
      }

      .role-option span {
        color: #5e6a7d;
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

