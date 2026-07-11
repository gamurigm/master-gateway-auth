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
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MenuItemComponent, AppIconComponent],
  template: `
    <div class="shell" [class.menu-open]="menuOpen">
      <header class="mobile-bar">
        <button class="icon-btn" type="button" (click)="toggleMenu()" [title]="menuOpen ? 'Cerrar menu' : 'Abrir menu'">
          <app-icon [name]="menuOpen ? 'lucidePanelLeftClose' : 'lucidePanelLeftOpen'" />
        </button>
        <strong>Master Gateway</strong>
        <span>{{ roleName }}</span>
      </header>

      <button *ngIf="menuOpen" class="menu-scrim" type="button" aria-label="Cerrar menu" (click)="toggleMenu()"></button>

      <aside class="sidebar" [attr.aria-hidden]="!menuOpen && isCompactViewport ? 'true' : null">
        <div class="brand">
          <span class="brand-mark"><app-icon name="lucideShieldCheck" [size]="21" /></span>
          <div>
            <strong>Master Gateway</strong>
            <span>Control de acceso</span>
          </div>
        </div>

        <div class="active-role">
          <span>Rol activo</span>
          <strong>{{ roleName }}</strong>
        </div>

        <nav>
          <section *ngFor="let module of modules" class="menu-module">
            <h2>{{ module.name }}</h2>
            <app-menu-item *ngFor="let item of module.menus" [node]="item" />
          </section>
        </nav>

        <button type="button" class="logout-button" (click)="logout()">
          <app-icon name="lucideLogOut" />
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
        grid-template-columns: 280px 1fr;
        background: var(--canvas);
      }

      .mobile-bar { display: none; }
      .menu-scrim { display: none; }

      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 20px;
        background: #17211c;
        border-right: 1px solid #2e3b34;
        padding: 24px 18px;
        z-index: 10;
      }

      .brand {
        display: grid;
        grid-template-columns: 38px 1fr;
        align-items: center;
        gap: 11px;
        padding-bottom: 18px;
        border-bottom: 1px solid #344139;
      }

      .brand-mark { width: 38px; height: 38px; display: grid; place-items: center; color: #fff; background: #08775b; border-radius: 6px; }
      .brand div { display: grid; gap: 3px; min-width: 0; }

      .brand strong {
        color: #fff;
        font-size: 16px;
        font-weight: 750;
        letter-spacing: 0;
      }

      .brand span {
        color: #a9b8b0;
        font-size: 12px;
        letter-spacing: 0;
      }

      .active-role { display: grid; gap: 4px; padding: 11px 12px; color: #dfe8e3; background: #202d26; border: 1px solid #344139; border-radius: 6px; }
      .active-role span { color: #9eaea5; font-size: 11px; text-transform: uppercase; }
      .active-role strong { font-size: 14px; }

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
        color: #91a299;
        text-transform: uppercase;
        letter-spacing: 0;
        font-weight: 700;
      }

      .workspace {
        padding: 32px;
        overflow-y: auto;
      }

      .logout-button { min-height: 40px; display: flex; align-items: center; gap: 9px; padding: 0 12px; color: #dfe8e3; background: transparent; border: 1px solid #3a4941; border-radius: 6px; font-weight: 650; }
      .logout-button:hover { color: #fff; background: #26342c; }

      @media (max-width: 800px) {
        .shell { display: block; padding-top: 58px; }
        .mobile-bar { position: fixed; inset: 0 0 auto; z-index: 30; height: 58px; display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 10px; padding: 0 14px; color: #fff; background: #17211c; border-bottom: 1px solid #344139; }
        .mobile-bar .icon-btn { color: #fff; }
        .mobile-bar span { max-width: 105px; overflow: hidden; color: #afbeb6; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .menu-scrim { position: fixed; inset: 58px 0 0; z-index: 19; display: block; width: 100%; border: 0; background: rgba(12, 18, 15, 0.55); }
        .sidebar {
          position: fixed;
          inset: 58px auto 0 0;
          z-index: 20;
          width: min(84vw, 300px);
          transform: translateX(-101%);
          transition: transform 180ms ease;
        }
        .menu-open .sidebar { transform: translateX(0); }
        .workspace { padding: 20px 14px; }
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
  menuOpen = false;
  isCompactViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

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
