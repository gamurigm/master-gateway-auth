import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="admin-page dashboard-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Panel principal</span>
          <h1>Administracion</h1>
          <p>Accesos rapidos para gestionar identidad, permisos y navegacion del sistema.</p>
        </div>
      </header>

      <div class="dashboard-hero">
        <div>
          <span>Rol activo</span>
          <strong>{{ roleName }}</strong>
        </div>
        <p>Usa las tarjetas para entrar directo a cada modulo administrativo.</p>
      </div>

      <div class="quick-grid" aria-label="Accesos de administracion">
        <a class="quick-card" routerLink="/app/users">
          <span class="quick-icon">U</span>
          <strong>Usuarios</strong>
          <span>Crear, editar y desactivar usuarios.</span>
        </a>
        <a class="quick-card" routerLink="/app/roles">
          <span class="quick-icon">R</span>
          <strong>Roles y permisos</strong>
          <span>Asignar usuarios, modulos y menus por rol.</span>
        </a>
        <a class="quick-card" routerLink="/app/modules">
          <span class="quick-icon">M</span>
          <strong>Modulos</strong>
          <span>Administrar areas funcionales del sistema.</span>
        </a>
        <a class="quick-card" routerLink="/app/menus">
          <span class="quick-icon">N</span>
          <strong>Menus</strong>
          <span>Configurar entradas visibles de navegacion.</span>
        </a>
      </div>
    </section>
  `,
  styles: [
    `
      .dashboard-page {
        max-width: 1220px;
      }

      .dashboard-hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 24px;
        color: #ffffff;
        background:
          radial-gradient(circle at top right, rgba(20, 184, 166, 0.5), transparent 20rem),
          linear-gradient(135deg, #0f172a, #1d4ed8);
        border-radius: 24px;
        box-shadow: 0 24px 70px rgba(37, 99, 235, 0.22);
      }

      .dashboard-hero span {
        display: block;
        margin-bottom: 6px;
        color: rgba(255, 255, 255, 0.72);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .dashboard-hero strong {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.04em;
      }

      .dashboard-hero p {
        max-width: 420px;
        margin: 0;
        color: rgba(255, 255, 255, 0.76);
        line-height: 1.55;
      }

      .quick-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 18px;
      }

      .quick-card {
        position: relative;
        display: grid;
        gap: 12px;
        min-height: 178px;
        padding: 22px;
        color: var(--text-main);
        text-decoration: none;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 22px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.07);
        overflow: hidden;
      }

      .quick-card::after {
        content: "";
        position: absolute;
        inset: auto 18px 16px 18px;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, #2563eb, #14b8a6);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.2s ease;
      }

      .quick-card:hover {
        transform: translateY(-4px);
        border-color: rgba(37, 99, 235, 0.35);
        box-shadow: 0 24px 60px rgba(37, 99, 235, 0.14);
      }

      .quick-card:hover::after {
        transform: scaleX(1);
      }

      .quick-icon {
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        color: #ffffff;
        background: linear-gradient(135deg, #2563eb, #0f766e);
        border-radius: 15px;
        font-weight: 900;
        box-shadow: 0 14px 28px rgba(37, 99, 235, 0.2);
      }

      .quick-card strong {
        color: #0f172a;
        font-size: 19px;
        font-weight: 850;
        letter-spacing: -0.03em;
      }

      .quick-card span:last-child {
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.5;
      }

      @media (max-width: 760px) {
        .dashboard-hero {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  roleName = this.authService.getCurrentRole()?.name ?? "Sin rol";
}
