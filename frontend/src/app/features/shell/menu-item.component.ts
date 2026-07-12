import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { MenuNode } from "../../core/api.models";

@Component({
  selector: "app-menu-item",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <a *ngIf="node.url && isInternal(node.url)" [routerLink]="node.url" class="menu-link">{{ node.name }}</a>
    <a *ngIf="node.url && !isInternal(node.url)" [href]="node.url" class="menu-link" target="_self" rel="noreferrer">
      {{ node.name }}
    </a>
    <span *ngIf="!node.url" class="group-label">{{ node.name }}</span>
    <div class="child-menu" *ngIf="node.children.length">
      <app-menu-item *ngFor="let child of node.children" [node]="child" />
    </div>
  `,
  styles: [
    `
      .menu-link,
      .group-label {
        display: flex;
        align-items: center;
        min-height: 40px;
        border-radius: 12px;
        padding: 0 14px;
        font-size: 14px;
      }

      .menu-link {
        color: #334155;
        text-decoration: none;
        font-weight: 750;
        transition: all 0.18s ease;
      }

      .menu-link:hover,
      .menu-link.active {
        color: #0f172a;
        background: #eef6ff;
        box-shadow: inset 3px 0 0 #2563eb;
      }

      .group-label {
        color: #64748b;
        font-weight: 850;
      }

      .child-menu {
        display: grid;
        gap: 4px;
        margin: 4px 0 4px 12px;
        padding-left: 10px;
        border-left: 1px solid rgba(148, 163, 184, 0.28);
      }
    `,
  ],
})
export class MenuItemComponent {
  @Input({ required: true }) node!: MenuNode;

  isInternal(url: string) {
    return url.startsWith('/app/');
  }
}
