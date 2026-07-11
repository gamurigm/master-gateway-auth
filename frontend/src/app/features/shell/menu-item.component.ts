import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuNode } from '../../core/api.models';

@Component({
  selector: 'app-menu-item',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <a *ngIf="node.url" [routerLink]="node.url" routerLinkActive="active" class="menu-link">{{ node.name }}</a>
    <span *ngIf="!node.url" class="group-label">{{ node.name }}</span>
    <div class="child-menu" *ngIf="node.children.length">
      <app-menu-item *ngFor="let child of node.children" [node]="child" />
    </div>
  `,
  styles: [
    `
      .menu-link {
        display: block;
        color: #d9e3dd;
        text-decoration: none;
        border-radius: 8px;
        padding: 10px 14px;
        transition: background 0.15s ease, color 0.15s ease;
        font-weight: 500;
        font-size: 14px;
      }
      .menu-link:hover, .menu-link.active {
        background: #08775b;
        color: #ffffff;
      }
      .group-label {
        display: block;
        font-weight: 700;
        padding: 10px 14px;
        color: #a9b8b0;
        font-size: 14px;
      }
      .child-menu {
        margin-left: 14px;
        border-left: 1px solid #425048;
        padding-left: 10px;
        margin-top: 4px;
      }
    `,
  ],
})
export class MenuItemComponent {
  @Input({ required: true }) node!: MenuNode;
}
