import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>Master Gateway</h1>
        <p>Ingresa tus credenciales para seleccionar el rol de trabajo.</p>

        <div class="error" *ngIf="error">{{ error }}</div>

        <form (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" [(ngModel)]="email" required>
          </div>

          <div class="field">
            <label for="password">Contrasena</label>
            <input id="password" name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required>
          </div>

          <button class="primary-button" type="submit" [disabled]="loading">
            {{ loading ? 'Validando...' : 'Ingresar' }}
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

