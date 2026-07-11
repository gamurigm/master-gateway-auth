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
        color: #172033;
        text-decoration: none;
        border-radius: 6px;
        padding: 9px 10px;
      }
      .menu-link:hover {
        background: #eef4ff;
      }
      .group-label {
        display: block;
        font-weight: 700;
        padding: 9px 10px;
      }
      .child-menu {
        margin-left: 12px;
        border-left: 1px solid #d8deea;
        padding-left: 8px;
      }
    `,
  ],
})
export class MenuItemComponent {
  @Input({ required: true }) node!: MenuNode;
}
