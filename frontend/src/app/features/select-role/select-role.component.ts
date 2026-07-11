import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleSummary } from '../../core/api.models';
import { AuthService } from '../../core/auth.service';
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-brand">
          <span class="auth-brand-mark"><app-icon name="lucideKeyRound" [size]="21" /></span>
          <strong>Master Gateway</strong>
        </div>
        <h1>Espacio de trabajo</h1>
        <p>Selecciona el rol con el que operaras en esta sesion.</p>

        <div class="error" *ngIf="error"><app-icon name="lucideCircleAlert" />{{ error }}</div>

        <button
          class="role-option"
          type="button"
          *ngFor="let role of roles"
          (click)="select(role.id)"
          [disabled]="loading"
        >
          <span class="role-icon"><app-icon name="lucideShieldCheck" /></span>
          <span class="role-copy"><strong>{{ role.name }}</strong><small>{{ role.description || 'Sin descripcion' }}</small></span>
          <app-icon name="lucideChevronRight" />
        </button>
      </section>
    </main>
  `,
  styles: [
    `
      .role-option {
        width: 100%;
        display: grid;
        grid-template-columns: 36px 1fr 20px;
        align-items: center;
        gap: 12px;
        text-align: left;
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 13px 14px;
        margin-bottom: 10px;
        background: var(--surface);
        transition: border-color 0.15s ease, background 0.15s ease;
      }

      .role-option:hover:not(:disabled) {
        background: var(--primary-soft);
        border-color: var(--primary-color);
      }
      .role-icon { width: 36px; height: 36px; display: grid; place-items: center; color: var(--primary-color); background: var(--primary-soft); border-radius: 6px; }
      .role-copy { min-width: 0; display: grid; gap: 3px; }
      .role-copy strong { color: var(--text-main); font-size: 14px; }
      .role-copy small { overflow: hidden; color: var(--text-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
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
