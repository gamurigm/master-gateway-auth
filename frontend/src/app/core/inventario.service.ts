import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { InventoryResponse } from "./api.models";

@Injectable({ providedIn: "root" })
export class InventarioService {
  private readonly http = inject(HttpClient);

  findProducts(apiBaseUrl: string): Observable<InventoryResponse> {
    return this.http.get<InventoryResponse>(this.productsUrl(apiBaseUrl));
  }

  productsUrl(apiBaseUrl: string) {
    const normalized = apiBaseUrl.trim().replace(/\/+$/, "");
    return normalized.endsWith("/productos")
      ? normalized
      : `${normalized}/productos`;
  }
}