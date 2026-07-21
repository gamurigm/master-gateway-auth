import api from './api'
import type {
  CreateExternalServiceDto,
  ExternalService,
  ProbeResult,
  ProbeServiceDto,
  ProvisionServiceDto,
} from '../types'

export const externalServicesService = {
  findAll() {
    return api.get<ExternalService[]>('/external-services')
  },
  findOne(id: string) {
    return api.get<ExternalService>(`/external-services/${id}`)
  },
  /** Verifica la disponibilidad SIN registrar el servicio. */
  probe(dto: ProbeServiceDto) {
    return api.post<ProbeResult>('/external-services/probe', dto)
  },
  /** Re-verifica un servicio ya registrado y persiste el resultado. */
  probeExisting(id: string) {
    return api.post<ProbeResult>(`/external-services/${id}/probe`, {})
  },
  create(dto: CreateExternalServiceDto) {
    return api.post<ExternalService>('/external-services', dto)
  },
  /** Genera módulo, menús y asignaciones de rol para el servicio. */
  provision(id: string, dto: ProvisionServiceDto) {
    return api.post<{ module: unknown; menus: number }>(
      `/external-services/${id}/provision`,
      dto,
    )
  },
  remove(id: string) {
    return api.delete<{ success: boolean }>(`/external-services/${id}`)
  },
}
