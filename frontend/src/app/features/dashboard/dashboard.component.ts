import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MenuModule, MenuNode } from "../../core/api.models";
import { AuthService } from "../../core/auth.service";
import { MenuService } from "../../core/menu.service";

interface DashboardShortcut {
  name: string;
  moduleName: string;
  url: string;
  iconLabel: string;
}

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="admin-page dashboard-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Panel principal</span>
          <h1>Inicio</h1>
          <p>Accesos disponibles para el rol activo.</p>
        </div>
      </header>

      <div class="dashboard-hero">
        <div>
          <span>Rol activo</span>
          <strong>{{ roleName }}</strong>
        </div>
        <p>Los accesos se cargan desde la configuracion de menus asignada al rol.</p>
      </div>

      <div *ngIf="loading" class="dashboard-state">
        <span class="state-spinner"></span>
        <strong>Cargando accesos</strong>
      </div>

      <div *ngIf="!loading && error" class="dashboard-state error-state">
        <strong>No se pudieron cargar los accesos</strong>
        <span>{{ error }}</span>
        <button type="button" class="secondary-button compact-action" (click)="loadShortcuts()">Reintentar</button>
      </div>

      <div *ngIf="!loading && !error" class="quick-grid" aria-label="Accesos disponibles">
        <ng-container *ngFor="let shortcut of shortcuts">
          <a *ngIf="isInternal(shortcut.url); else externalShortcut" class="quick-card" [routerLink]="shortcut.url">
            <span class="quick-icon">{{ shortcut.iconLabel }}</span>
            <span class="quick-module">{{ shortcut.moduleName }}</span>
            <strong>{{ shortcut.name }}</strong>
          </a>

          <ng-template #externalShortcut>
            <a class="quick-card" [href]="shortcut.url" target="_self" rel="noreferrer">
              <span class="quick-icon">{{ shortcut.iconLabel }}</span>
              <span class="quick-module">{{ shortcut.moduleName }}</span>
              <strong>{{ shortcut.name }}</strong>
            </a>
          </ng-template>
        </ng-container>

        <div *ngIf="shortcuts.length === 0" class="dashboard-state">
          <strong>Sin accesos asignados</strong>
          <span>El rol activo no tiene menus visibles.</span>
        </div>
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
        min-height: 160px;
        align-content: start;
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

      .quick-module {
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dashboard-state {
        display: grid;
        gap: 10px;
        max-width: 520px;
        padding: 22px;
        color: #64748b;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 18px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.07);
      }

      .dashboard-state strong {
        color: #0f172a;
      }

      .error-state strong {
        color: #991b1b;
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
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly menuService = inject(MenuService);

  roleName = this.authService.getCurrentRole()?.name ?? "Sin rol";
  shortcuts: DashboardShortcut[] = [];
  loading = true;
  error = "";

  ngOnInit() {
    this.loadShortcuts();
  }

  loadShortcuts() {
    this.loading = true;
    this.error = "";

    this.menuService.tree().subscribe({
      next: (modules) => {
        this.shortcuts = this.buildShortcuts(Array.isArray(modules) ? modules : []);
        this.loading = false;
      },
      error: () => {
        this.shortcuts = [];
        this.loading = false;
        this.error = "Verifica la sesion y la disponibilidad del gateway.";
      },
    });
  }

  isInternal(url: string) {
    return url.startsWith("/app/");
  }

  private buildShortcuts(modules: MenuModule[]) {
    const shortcuts: DashboardShortcut[] = [];

    for (const module of modules) {
      this.collectMenuShortcuts(module.name, module.menus, shortcuts);
    }

    return shortcuts;
  }

  private collectMenuShortcuts(moduleName: string, menus: MenuNode[], shortcuts: DashboardShortcut[]) {
    for (const menu of menus) {
      if (menu.url) {
        shortcuts.push({
          name: menu.name,
          moduleName,
          url: menu.url,
          iconLabel: this.getIconLabel(menu),
        });
      }

      this.collectMenuShortcuts(moduleName, menu.children ?? [], shortcuts);
    }
  }

  private getIconLabel(menu: MenuNode) {
    const source = menu.icon?.trim() || menu.name.trim();
    return source.charAt(0).toUpperCase() || "A";
  }
}
