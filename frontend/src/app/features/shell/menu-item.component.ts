import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuNode } from '../../core/api.models';

@Component({
  selector: 'app-menu-item',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a *ngIf="node.url" [routerLink]="node.url" class="menu-link">{{ node.name }}</a>
    <span *ngIf="!node.url" class="group-label">{{ node.name }}</span>
    <div class="child-menu" *ngIf="node.children.length">
      <app-menu-item *ngFor="let child of node.children" [node]="child" />
    </div>
  `,
  styles: [
    `
      .menu-link {
        display: block;
        color: var(--text-main);
        text-decoration: none;
        border-radius: 8px;
        padding: 10px 14px;
        transition: all 0.2s ease;
        font-weight: 500;
        font-size: 14px;
      }
      .menu-link:hover {
        background: var(--primary-color);
        color: #ffffff;
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
      }
      .group-label {
        display: block;
        font-weight: 700;
        padding: 10px 14px;
        color: var(--text-muted);
        font-size: 14px;
      }
      .child-menu {
        margin-left: 14px;
        border-left: 2px solid rgba(0,0,0,0.06);
        padding-left: 10px;
        margin-top: 4px;
      }
    `,
  ],
})
export class MenuItemComponent {
  @Input({ required: true }) node!: MenuNode;
}
