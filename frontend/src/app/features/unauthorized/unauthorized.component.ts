import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>Acceso denegado</h1>
        <p>Tu rol activo no permite acceder a este recurso.</p>
        <a routerLink="/app">Volver al dashboard</a>
      </section>
    </main>
  `,
})
export class UnauthorizedComponent {}

