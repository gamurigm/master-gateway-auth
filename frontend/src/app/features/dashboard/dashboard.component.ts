import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { RolesService } from '../../core/roles.service';
import { ModulesService } from '../../core/modules.service';
import { MenuService } from '../../core/menu.service';
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <section class="dashboard">
      <header class="page-header">
        <div>
          <p class="page-kicker">Resumen operativo</p>
          <h1>Dashboard</h1>
          <p class="page-description">Administracion de identidades y autorizaciones para el rol {{ roleName }}.</p>
        </div>
      </header>

      <div class="metrics panel">
        <div class="stat-item">
          <div class="stat-icon users-icon"><app-icon name="lucideUsers" [size]="21" /></div>
          <div class="stat-info">
            <span class="stat-value">{{ userCount }}</span>
            <span class="stat-label">Usuarios</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon roles-icon"><app-icon name="lucideShieldCheck" [size]="21" /></div>
          <div class="stat-info">
            <span class="stat-value">{{ roleCount }}</span>
            <span class="stat-label">Roles</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon modules-icon"><app-icon name="lucideBoxes" [size]="21" /></div>
          <div class="stat-info">
            <span class="stat-value">{{ moduleCount }}</span>
            <span class="stat-label">Modulos</span>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon menus-icon"><app-icon name="lucideMenu" [size]="21" /></div>
          <div class="stat-info">
            <span class="stat-value">{{ menuCount }}</span>
            <span class="stat-label">Menus</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: hidden; }
    .stat-item { min-width: 0; display: flex; align-items: center; gap: 14px; padding: 22px; border-right: 1px solid var(--border); }
    .stat-item:last-child { border-right: 0; }
    .stat-icon {
      width: 42px; height: 42px; border-radius: 6px;
      display: grid; place-items: center; flex-shrink: 0
    }
    .users-icon { background: #e9f2fb; color: #1769aa }
    .roles-icon { background: var(--primary-soft); color: var(--primary-color) }
    .modules-icon { background: var(--warning-soft); color: var(--warning) }
    .menus-icon { background: #f2eef9; color: #6b4ba1 }
    .stat-info { display: grid; gap: 2px }
    .stat-value { font-size: 25px; font-weight: 800; letter-spacing: 0; color: var(--text-main) }
    .stat-label { font-size: 13px; color: var(--text-muted); font-weight: 500 }
    @media (max-width: 980px) { .metrics { grid-template-columns: repeat(2, 1fr); } .stat-item:nth-child(2) { border-right: 0; } .stat-item:nth-child(-n+2) { border-bottom: 1px solid var(--border); } }
    @media (max-width: 520px) { .metrics { grid-template-columns: 1fr; } .stat-item { border-right: 0; border-bottom: 1px solid var(--border); } .stat-item:nth-child(3) { border-bottom: 1px solid var(--border); } .stat-item:last-child { border-bottom: 0; } }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly modulesService = inject(ModulesService);
  private readonly menuService = inject(MenuService);

  roleName = this.authService.getCurrentRole()?.name ?? 'Sin rol';
  userCount = 0;
  roleCount = 0;
  moduleCount = 0;
  menuCount = 0;

  ngOnInit() {
    this.usersService.findAll(1, 1).subscribe({ next: (res) => (this.userCount = res.total) });
    this.rolesService.findAll().subscribe({ next: (res) => (this.roleCount = res.length) });
    this.modulesService.findAll().subscribe({ next: (res) => (this.moduleCount = res.length) });
    this.menuService.findAll().subscribe({ next: (res) => (this.menuCount = res.length) });
  }
}
