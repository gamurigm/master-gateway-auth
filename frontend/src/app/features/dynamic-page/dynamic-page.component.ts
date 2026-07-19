import { Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "app-dynamic-page",
  standalone: true,
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Vista dinamica</span>
          <h1>{{ title }}</h1>
          <p>Esta ruta existe en el menu, pero aun no tiene una pantalla CRUD dedicada.</p>
        </div>
      </header>

      <div class="admin-card">
        <div class="empty-state">
          <strong>Pantalla pendiente de implementar</strong>
          <span>La navegacion ya funciona; falta conectar un componente especifico para esta opcion.</span>
        </div>
      </div>
    </section>
  `,
})
export class DynamicPageComponent {
  private readonly route = inject(ActivatedRoute);
  title = this.route.snapshot.data["title"] as string;
}
