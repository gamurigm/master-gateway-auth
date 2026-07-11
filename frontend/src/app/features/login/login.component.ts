import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-brand">
          <span class="auth-brand-mark"><app-icon name="lucideShieldCheck" [size]="22" /></span>
          <strong>Master Gateway</strong>
        </div>
        <h1>Master Gateway</h1>
        <p>Accede al centro de control de identidades, roles y permisos.</p>

        <div class="error" *ngIf="error"><app-icon name="lucideCircleAlert" />{{ error }}</div>

        <form (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" [(ngModel)]="email" required>
          </div>

          <div class="field">
            <label for="password">Contrasena</label>
            <div class="input-action">
              <input id="password" name="password" [type]="showPassword ? 'text' : 'password'" autocomplete="current-password" [(ngModel)]="password" required>
              <button class="icon-btn" type="button" (click)="showPassword = !showPassword" [title]="showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'">
                <app-icon [name]="showPassword ? 'lucideEyeOff' : 'lucideEye'" />
              </button>
            </div>
          </div>

          <button class="primary-button" type="submit" [disabled]="loading">
            <app-icon *ngIf="loading" name="lucideLoaderCircle" class="spin" />
            {{ loading ? 'Validando' : 'Ingresar' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  showPassword = false;
  loading = false;
  error = '';

  submit() {
    this.loading = true;
    this.error = '';

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        void this.router.navigateByUrl('/select-role');
      },
      error: () => {
        this.loading = false;
        this.error = 'Credenciales invalidas';
      },
    });
  }
}
