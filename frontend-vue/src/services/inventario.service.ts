import type { InventoryResponse } from '../types'

function productsUrl(apiBaseUrl: string): string {
  const url = apiBaseUrl.replace(/\/+$/, '')
  return url.endsWith('/productos') ? url : `${url}/productos`
}

export const inventarioService = {
  async findProducts(apiBaseUrl: string) {
    const url = productsUrl(apiBaseUrl)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as InventoryResponse
  },
}
