import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Permission } from "./api.models";

@Injectable({ providedIn: "root" })
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  findAll(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`);
  }
}
