import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { finalize, timeout } from "rxjs";
import { InventoryProduct } from "../../core/api.models";
import { InventarioService } from "../../core/inventario.service";
import { environment } from "../../../environments/environment";

const INVENTORY_API_URL_KEY = "inventoryApiUrl";

@Component({
  selector: "app-inventory-list",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="admin-page inventory-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Microservicio</span>
          <h1>Inventario</h1>
          <p>Consulta productos desde un API externo validado por Master Gateway.</p>
        </div>
      </header>

      <div class="admin-card inventory-config">
        <label class="field api-field">
          <span>Ruta base del API</span>
          <input
            type="url"
            [(ngModel)]="apiBaseUrl"
            placeholder="http://localhost:3007/inventario"
            autocomplete="off"
          />
        </label>
        <button class="primary-button compact-action" type="button" [disabled]="loading" (click)="loadProducts()">
          Consultar
        </button>
      </div>

      <div class="admin-card">
        <div *ngIf="loading" class="list-state loading-state">
          <span class="state-spinner"></span>
          <strong>Cargando inventario</strong>
          <small>Consultando el microservicio configurado...</small>
        </div>

        <div *ngIf="!loading && error" class="list-state error-state">
          <strong>No se pudo cargar inventario</strong>
          <small>{{ error }}</small>
          <button class="secondary-button compact-action" type="button" (click)="loadProducts()">Reintentar</button>
        </div>

        <table *ngIf="!loading && !error" class="crud-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Stock</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let product of products">
              <td><code>{{ product.sku }}</code></td>
              <td><strong>{{ product.name }}</strong></td>
              <td>{{ product.stock }}</td>
              <td>
                <span class="badge" [class.badge-active]="product.status === 'DISPONIBLE'" [class.badge-inactive]="product.status !== 'DISPONIBLE'">
                  {{ product.status }}
                </span>
              </td>
            </tr>
            <tr *ngIf="products.length === 0">
              <td colspan="4">
                <div class="empty-state">
                  <strong>No hay productos disponibles</strong>
                  <span>El microservicio no devolvio registros para mostrar.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [
    `
      .inventory-page {
        max-width: 1120px;
      }

      .inventory-config {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: end;
        padding: 22px;
      }

      .api-field {
        margin: 0;
      }

      .api-field span {
        color: #475569;
        font-size: 13px;
        font-weight: 800;
      }

      .api-field input {
        min-height: 44px;
      }

      @media (max-width: 760px) {
        .inventory-config {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class InventoryListComponent implements OnInit {
  private readonly inventarioService = inject(InventarioService);

  apiBaseUrl = this.loadStoredApiUrl();
  products: InventoryProduct[] = [];
  loading = false;
  error = "";

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    const apiUrl = this.apiBaseUrl.trim();
    if (!apiUrl) {
      this.error = "Ingresa la ruta base del API de inventario.";
      this.products = [];
      return;
    }

    localStorage.setItem(INVENTORY_API_URL_KEY, apiUrl);
    this.loading = true;
    this.error = "";

    this.inventarioService
      .findProducts(apiUrl)
      .pipe(
        timeout(7000),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.products = Array.isArray(response?.items) ? response.items : [];
        },
        error: () => {
          this.products = [];
          this.error = "Verifica la ruta, que el microservicio este activo y que tu rol tenga acceso.";
        },
      });
  }

  private loadStoredApiUrl() {
    return localStorage.getItem(INVENTORY_API_URL_KEY) ?? environment.inventoryApiUrl;
  }
}