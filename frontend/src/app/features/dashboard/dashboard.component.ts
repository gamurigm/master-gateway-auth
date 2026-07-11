import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { RolesService } from '../../core/roles.service';
import { ModulesService } from '../../core/modules.service';
import { MenuService } from '../../core/menu.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="dashboard">
      <header class="dash-header">
        <h1>Dashboard</h1>
        <p>Rol activo: <strong>{{ roleName }}</strong></p>
      </header>

      <div class="cards">
        <div class="stat-card">
          <div class="stat-icon users-icon">&#128100;</div>
          <div class="stat-info">
            <span class="stat-value">{{ userCount }}</span>
            <span class="stat-label">Usuarios</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon roles-icon">&#128274;</div>
          <div class="stat-info">
            <span class="stat-value">{{ roleCount }}</span>
            <span class="stat-label">Roles</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon modules-icon">&#128230;</div>
          <div class="stat-info">
            <span class="stat-value">{{ moduleCount }}</span>
            <span class="stat-label">Modulos</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon menus-icon">&#9776;</div>
          <div class="stat-info">
            <span class="stat-value">{{ menuCount }}</span>
            <span class="stat-label">Menus</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .dashboard { animation: slideUpFade 0.4s ease-out; }
    .dash-header { margin-bottom: 32px }
    .dash-header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.3px }
    .dash-header p { margin: 0; color: var(--text-muted); font-size: 15px }
    .dash-header strong { color: var(--text-main) }
    .cards {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px
    }
    .stat-card {
      display: flex; align-items: center; gap: 16px;
      background: var(--glass-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border); border-radius: 16px;
      box-shadow: var(--glass-shadow); padding: 24px; transition: transform 0.2s
    }
    .stat-card:hover { transform: translateY(-2px) }
    .stat-icon {
      width: 56px; height: 56px; border-radius: 14px;
      display: grid; place-items: center; font-size: 24px; flex-shrink: 0
    }
    .users-icon { background: #eff6ff; color: #2563eb }
    .roles-icon { background: #f0fdf4; color: #16a34a }
    .modules-icon { background: #fefce8; color: #ca8a04 }
    .menus-icon { background: #fdf2f8; color: #db2777 }
    .stat-info { display: grid; gap: 2px }
    .stat-value { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: var(--text-main) }
    .stat-label { font-size: 13px; color: var(--text-muted); font-weight: 500 }
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
