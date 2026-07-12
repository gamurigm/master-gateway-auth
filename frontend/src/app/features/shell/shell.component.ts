import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import {
  Route,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { MenuModule, MenuNode } from "../../core/api.models";
import { AuthService } from "../../core/auth.service";
import { MenuService } from "../../core/menu.service";
import { baseAppChildren } from "../../app-route-children";
import { DashboardComponent } from "../dashboard/dashboard.component";
import { DynamicPageComponent } from "../dynamic-page/dynamic-page.component";
import { UserListComponent } from "../user-list/user-list.component";
import { RoleListComponent } from "../role-list/role-list.component";
import { ModuleListComponent } from "../module-list/module-list.component";
import { MenuListComponent } from "../menu-list/menu-list.component";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">MG</span>
          <div>
            <strong>Master Gateway</strong>
            <span>{{ roleName }}</span>
          </div>
        </div>

        <nav class="side-nav" aria-label="Navegacion principal">
          <section class="menu-module">
            <h2>Administracion</h2>
            <a class="menu-link" routerLink="/app" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
            <a class="menu-link" routerLink="/app/users" routerLinkActive="active">Usuarios</a>
            <a class="menu-link" routerLink="/app/roles" routerLinkActive="active">Roles</a>
            <a class="menu-link" routerLink="/app/modules" routerLinkActive="active">Modulos</a>
            <a class="menu-link" routerLink="/app/menus" routerLinkActive="active">Menus</a>
          </section>
        </nav>

        <button type="button" class="secondary-button logout-button" (click)="logout()">
          Cerrar sesion
        </button>
      </aside>

      <main class="workspace">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        background:
          radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 32rem),
          linear-gradient(135deg, #f6f8fb 0%, #eef3f8 100%);
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        gap: 24px;
        background: rgba(255, 255, 255, 0.92);
        border-right: 1px solid rgba(148, 163, 184, 0.22);
        padding: 24px;
        box-shadow: 12px 0 36px rgba(15, 23, 42, 0.06);
        z-index: 10;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      }

      .brand-mark {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: #ffffff;
        font-weight: 900;
        letter-spacing: -0.04em;
        background: linear-gradient(135deg, #2563eb, #0f766e);
        box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
      }

      .brand strong {
        display: block;
        color: #0f172a;
        font-size: 17px;
        font-weight: 850;
        letter-spacing: -0.03em;
      }

      .brand span:not(.brand-mark) {
        display: block;
        margin-top: 3px;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .side-nav {
        display: grid;
        gap: 20px;
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
      }

      .menu-module h2 {
        margin: 0 0 10px;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .menu-link {
        display: flex;
        align-items: center;
        min-height: 42px;
        color: #334155;
        text-decoration: none;
        border-radius: 12px;
        padding: 0 14px;
        font-weight: 750;
        font-size: 14px;
        transition: all 0.18s ease;
      }

      .menu-link:hover,
      .menu-link.active {
        color: #0f172a;
        background: #eef6ff;
        box-shadow: inset 3px 0 0 #2563eb;
      }

      .logout-button {
        width: 100%;
      }

      .workspace {
        min-width: 0;
        padding: 32px 40px;
      }

      @media (max-width: 900px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          position: static;
          height: auto;
        }

        .workspace {
          padding: 20px;
        }
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  modules: MenuModule[] = [];
  roleName = this.authService.getCurrentRole()?.name ?? "Sin rol";

  ngOnInit() {
    this.menuService.tree().subscribe({
      next: (modules) => {
        this.modules = Array.isArray(modules) ? modules : [];
        this.registerDynamicRoutes(this.modules);
      },
      error: () => {
        this.modules = [];
      },
    });
  }

  logout() {
    const logoutRequest = this.authService.logout();
    this.authService.clearSession();
    void this.router.navigateByUrl("/login");
    logoutRequest.subscribe({ error: () => undefined });
  }

  private registerDynamicRoutes(modules: MenuModule[]) {
    const dynamicChildren = this.flattenMenuRoutes(modules);
    const children = this.mergeChildren(baseAppChildren, dynamicChildren);
    const nextConfig = this.router.config.map((route) =>
      route.path === "app"
        ? {
            ...route,
            children,
          }
        : route,
    );

    this.router.resetConfig(nextConfig);
  }

  private readonly routeMap: Record<string, any> = {
    users: UserListComponent,
    roles: RoleListComponent,
    modules: ModuleListComponent,
    menus: MenuListComponent,
  };

  private flattenMenuRoutes(modules: MenuModule[]): Route[] {
    const routes: Route[] = [];

    const visit = (node: MenuNode) => {
      if (node.url?.startsWith("/app/")) {
        const path = node.url.replace("/app/", "");
        const component = this.routeMap[path] ?? DynamicPageComponent;
        routes.push({ path, component, data: { title: node.name } });
      }
      (node.children ?? []).forEach(visit);
    };

    modules.flatMap((module) => module.menus).forEach(visit);
    return routes;
  }

  private mergeChildren(baseChildren: Route[], dynamicChildren: Route[]) {
    const merged = new Map<string, Route>();
    for (const route of baseChildren) {
      merged.set(route.path ?? "", route);
    }
    for (const route of dynamicChildren) {
      merged.set(route.path ?? "", route);
    }

    if (!merged.has("")) {
      merged.set("", { path: "", component: DashboardComponent });
    }

    return [...merged.values()];
  }
}
