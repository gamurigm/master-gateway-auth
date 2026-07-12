import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="dashboard-page">
      <header class="content-header">
        <h1>Administracion</h1>
        <p>Rol activo: {{ roleName }}</p>
      </header>

      <div class="quick-grid" aria-label="Accesos de administracion">
        <a class="quick-card" routerLink="/app/users">
          <strong>Usuarios</strong>
          <span>Crear, editar y desactivar usuarios.</span>
        </a>
        <a class="quick-card" routerLink="/app/roles">
          <strong>Roles</strong>
          <span>Gestionar roles y permisos.</span>
        </a>
        <a class="quick-card" routerLink="/app/modules">
          <strong>Modulos</strong>
          <span>Administrar modulos del sistema.</span>
        </a>
        <a class="quick-card" routerLink="/app/menus">
          <strong>Menus</strong>
          <span>Configurar opciones de navegacion.</span>
        </a>
      </div>
    </section>
  `,
  styles: [
    `
      .dashboard-page {
        display: grid;
        gap: 24px;
      }

      .content-header h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      .content-header p {
        margin: 0;
        color: #5e6a7d;
      }

      .quick-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .quick-card {
        display: grid;
        gap: 8px;
        min-height: 120px;
        padding: 20px;
        color: var(--text-main);
        text-decoration: none;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: 12px;
        box-shadow: var(--glass-shadow);
      }

      .quick-card:hover {
        transform: translateY(-2px);
        border-color: var(--primary-color);
      }

      .quick-card strong {
        font-size: 18px;
      }

      .quick-card span {
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.4;
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  roleName = this.authService.getCurrentRole()?.name ?? "Sin rol";
}
