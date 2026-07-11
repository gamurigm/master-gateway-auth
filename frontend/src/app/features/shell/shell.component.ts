import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Route, Router, RouterOutlet } from '@angular/router';
import { MenuModule, MenuNode } from '../../core/api.models';
import { AuthService } from '../../core/auth.service';
import { MenuService } from '../../core/menu.service';
import { baseAppChildren } from '../../app-route-children';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { DynamicPageComponent } from '../dynamic-page/dynamic-page.component';
import { UserListComponent } from '../user-list/user-list.component';
import { RoleListComponent } from '../role-list/role-list.component';
import { ModuleListComponent } from '../module-list/module-list.component';
import { MenuListComponent } from '../menu-list/menu-list.component';
import { MenuItemComponent } from './menu-item.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MenuItemComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <strong>Master Gateway</strong>
          <span>{{ roleName }}</span>
        </div>

        <nav>
          <section *ngFor="let module of modules" class="menu-module">
            <h2>{{ module.name }}</h2>
            <app-menu-item *ngFor="let item of module.menus" [node]="item" />
          </section>
        </nav>

        <button type="button" class="secondary-button" (click)="logout()">Cerrar sesion</button>
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
        grid-template-columns: 280px 1fr;
        background: var(--bg-gradient);
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 24px;
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-right: 1px solid var(--glass-border);
        padding: 32px 24px;
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.02);
        z-index: 10;
      }

      .brand {
        display: grid;
        gap: 6px;
        padding-bottom: 24px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }

      .brand strong {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(90deg, #0f172a, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .brand span {
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      nav {
        display: grid;
        gap: 24px;
        flex: 1;
        overflow-y: auto;
      }
      
      nav::-webkit-scrollbar {
        width: 4px;
      }
      nav::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }

      .menu-module h2 {
        margin: 0 0 12px;
        font-size: 11px;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
      }

      .workspace {
        padding: 40px;
        overflow-y: auto;
      }

      @media (max-width: 800px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          border-right: 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding: 20px;
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
  roleName = this.authService.getCurrentRole()?.name ?? 'Sin rol';

  ngOnInit() {
    this.menuService.tree().subscribe({
      next: (modules) => {
        this.modules = modules;
        this.registerDynamicRoutes(modules);
      },
      error: () => {
        this.modules = [];
      },
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
      },
    });
  }

  private registerDynamicRoutes(modules: MenuModule[]) {
    const dynamicChildren = this.flattenMenuRoutes(modules);
    const children = this.mergeChildren(baseAppChildren, dynamicChildren);
    const nextConfig = this.router.config.map((route) =>
      route.path === 'app'
        ? {
            ...route,
            children,
          }
        : route,
    );

    this.router.resetConfig(nextConfig);
  }

  private readonly routeMap: Record<string, any> = {
    'users': UserListComponent,
    'roles': RoleListComponent,
    'modules': ModuleListComponent,
    'menus': MenuListComponent,
  };

  private flattenMenuRoutes(modules: MenuModule[]): Route[] {
    const routes: Route[] = [];

    const visit = (node: MenuNode) => {
      if (node.url?.startsWith('/app/')) {
        const path = node.url.replace('/app/', '');
        const component = this.routeMap[path] ?? DynamicPageComponent;
        routes.push({ path, component, data: { title: node.name } });
      }
      node.children.forEach(visit);
    };

    modules.flatMap((module) => module.menus).forEach(visit);
    return routes;
  }

  private mergeChildren(baseChildren: Route[], dynamicChildren: Route[]) {
    const merged = new Map<string, Route>();
    for (const route of baseChildren) {
      merged.set(route.path ?? '', route);
    }
    for (const route of dynamicChildren) {
      merged.set(route.path ?? '', route);
    }

    if (!merged.has('')) {
      merged.set('', { path: '', component: DashboardComponent });
    }

    return [...merged.values()];
  }
}

