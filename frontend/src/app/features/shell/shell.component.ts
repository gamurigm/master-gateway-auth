import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Route, Router, RouterOutlet } from '@angular/router';
import { MenuModule, MenuNode } from '../../core/api.models';
import { AuthService } from '../../core/auth.service';
import { MenuService } from '../../core/menu.service';
import { baseAppChildren } from '../../app-route-children';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { DynamicPageComponent } from '../dynamic-page/dynamic-page.component';
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
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 24px;
        background: #ffffff;
        border-right: 1px solid #d8deea;
        padding: 20px;
      }

      .brand {
        display: grid;
        gap: 4px;
      }

      .brand span {
        color: #5e6a7d;
        font-size: 14px;
      }

      nav {
        display: grid;
        gap: 18px;
        flex: 1;
      }

      .menu-module h2 {
        margin: 0 0 8px;
        font-size: 13px;
        color: #667085;
        text-transform: uppercase;
      }

      .workspace {
        padding: 28px;
      }

      @media (max-width: 800px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          border-right: 0;
          border-bottom: 1px solid #d8deea;
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

  private flattenMenuRoutes(modules: MenuModule[]): Route[] {
    const routes: Route[] = [];

    const visit = (node: MenuNode) => {
      if (node.url?.startsWith('/app/')) {
        routes.push({
          path: node.url.replace('/app/', ''),
          component: DynamicPageComponent,
          data: { title: node.name },
        });
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

