import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="content-header">
      <h1>Dashboard</h1>
      <p>Rol activo: {{ roleName }}</p>
    </section>
  `,
  styles: [
    `
      .content-header h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      .content-header p {
        margin: 0;
        color: #5e6a7d;
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  roleName = this.authService.getCurrentRole()?.name ?? 'Sin rol';
}

