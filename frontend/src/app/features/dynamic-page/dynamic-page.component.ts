import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-dynamic-page',
  standalone: true,
  template: `
    <section class="content-header">
      <h1>{{ title }}</h1>
      <p>Vista registrada dinamicamente desde el menu del Master Gateway.</p>
    </section>
  `,
  styles: [
    `
      .content-header h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      .content-header p {
        margin: 0;
        color: #5e6a7d;
      }
    `,
  ],
})
export class DynamicPageComponent {
  private readonly route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'] as string;
}

