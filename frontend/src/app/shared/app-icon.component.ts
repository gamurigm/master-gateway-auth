import { Component, Input } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBoxes,
  lucideChevronLeft,
  lucideChevronRight,
  lucideCircleAlert,
  lucideEye,
  lucideEyeOff,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLoaderCircle,
  lucideLogOut,
  lucideMenu,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
  lucidePencil,
  lucidePlus,
  lucideSettings,
  lucideShieldCheck,
  lucideTrash2,
  lucideUserRound,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [NgIconComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideBoxes,
      lucideChevronLeft,
      lucideChevronRight,
      lucideCircleAlert,
      lucideEye,
      lucideEyeOff,
      lucideKeyRound,
      lucideLayoutDashboard,
      lucideLoaderCircle,
      lucideLogOut,
      lucideMenu,
      lucidePanelLeftClose,
      lucidePanelLeftOpen,
      lucidePencil,
      lucidePlus,
      lucideSettings,
      lucideShieldCheck,
      lucideTrash2,
      lucideUserRound,
      lucideUsers,
      lucideX,
    }),
  ],
  template: `<ng-icon [name]="name" [size]="size" aria-hidden="true" />`,
})
export class AppIconComponent {
  @Input({ required: true }) name = '';
  @Input({ transform: (value: string | number) => String(value) }) size = '18';
}
