
Plan: Integrar URL destino de microservicio al crear Menús
Razón
Actualmente, crear un menú desde Módulos → Menús solo genera un registro de navegación en el sidebar. Cuando el usuario hace clic, el DynamicPageView intenta llamar al proxy (/api/proxy/...) pero este falla porque no hay ExternalServiceRoute que le indique a dónde redirigir. El usuario se ve forzado a usar el módulo External Services (otro flujo, con otro formulario) para que el proxy funcione.
La solución es permitir que al crear/editar un Menú se pueda especificar opcionalmente la URL destino del microservicio, y que el backend cree automáticamente la ExternalServiceRoute necesaria, eliminando la dependencia del módulo External Services para este caso de uso.
Archivos a modificar (6)

1. backend/src/menus/dto/create-menu.dto.ts
   Agregar dos campos opcionales:
   Campo Tipo Validación Descripción
   targetUrl string? @IsOptional(), @IsString(), @MaxLength(2048), @Matches(/^https?:\/\/.+/) URL destino del microservicio (ej. <http://inventario:3007/inventario/productos>)
   methods string[]? @IsOptional(), @IsArray(), @ArrayMinSize(1), @IsIn(['GET','POST','PUT','PATCH','DELETE'], { each: true }) Métodos HTTP permitidos (default ['GET'])
2. backend/src/menus/dto/update-menu.dto.ts
   Mismos campos que create, pero envolverlos en @IsOptional().
3. backend/src/menus/menus.service.ts
   Modificar tres métodos:
   create() — Si dto.targetUrl está presente:
4. Auto-crear un ExternalService oculto con:

- code: route<menuId></menuid> (prefijo route para distinguirlos de servicios registrados manualmente)
- name: Ruta: <menu.name>
- baseUrl: derivado de targetUrl (solo protocolo + host, ej. <http://inventario:3007>)
- estado: ACTIVO

1. Crear el Menu (como hoy)
2. Crear ExternalServiceRoute:

- serviceId: id del ExternalService creado
- menuId: id del menú creado
- publicPath: derivado de menu.url (ej. /app/inventario/productos → /inventario/productos)
- targetPath: la ruta del path del targetUrl (ej. /inventario/productos)
- methods: los métodos del dto o ['GET']

1. Envolver en $transaction para atomicidad
   update() — Si dto.targetUrl cambió:

- Buscar ExternalServiceRoute existente vinculada al menú
- Si existe y targetUrl es null → soft-delete la ruta
- Si existe y targetUrl cambió → actualizar targetPath y baseUrl del ExternalService
- Si no existe y targetUrl es nuevo → crear ExternalService + ruta (misma lógica que create)
  remove() — Ya maneja cascada para ExternalServiceRoute (línea 149). Agregar también soft-delete del ExternalService oculto (solo si code empieza con route).

1. frontend-vue/src/types/index.ts
   Agregar campos al Menu, CreateMenuDto y UpdateMenuDto:
   export interface Menu {
   // ... existentes
   targetUrl?: string | null
   methods?: string[]
   }

export interface CreateMenuDto {
  // ... existentes
  targetUrl?: string
  methods?: string[]
}

export interface UpdateMenuDto {
  // ... existentes
  targetUrl?: string | null
  methods?: string[]
}
5. frontend-vue/src/views/MenuFormView.vue
Agregar en el template, después del campo "Ruta (URL)":

<div v-if="showProxyFields" class="proxy-section">
  <h3>Proxy a microservicio</h3>
  <div class="field">
    <label>URL destino</label>
    <input v-model="form.targetUrl" placeholder="http://inventario:3007/inventario/productos">
    <p class="help">URL completa del endpoint en el microservicio</p>
  </div>
  <div class="field">
    <label>Métodos HTTP</label>
    <div class="checkbox-group">
      <label v-for="m in ['GET','POST','PUT','PATCH','DELETE']" :key="m">
        <input type="checkbox" :value="m" v-model="form.methods"> {{ m }}
      </label>
    </div>
  </div>
</div>
- showProxyFields = computed que retorna true si form.url empieza con /app/
- form.methods inicializar como ['GET']
En el saveMenu():
if (form.value.targetUrl) dto.targetUrl = form.value.targetUrl
if (form.value.methods?.length) dto.methods = form.value.methods
6. frontend-vue/src/styles/main.css (si es necesario)
Agregar estilos para .proxy-section, .checkbox-group y .help si no existen ya.
Flujo resultante
Usuario en UI
  → Módulos → Crear menú
  → Nombre: "Productos"
  → Ruta: "/app/inventario/productos"  ← se muestran campos proxy
  → URL destino: "http://inventario:3007/inventario/productos"
  → Métodos: GET
  → Guardar

Backend:
  → Crea ExternalService oculto (code: "route<uuid></uuid>", baseUrl: "<http://inventario:3007>")
  → Crea Menu
  → Crea ExternalServiceRoute (publicPath: "/inventario/productos", targetPath: "/inventario/productos")
  → Todo en una transacción

Usuario clicks en "Productos":
  → DynamicPageView llama a /api/proxy/inventario/productos
  → ServiceProxy encuentra la ExternalServiceRoute
  → Redirige a <http://inventario:3007/inventario/productos>
  → Responde con los productos ✅
Consideraciones

- Menús sin targetUrl siguen funcionando exactamente como hoy (solo navegación, sin proxy).
- Edición: si se limpia la URL destino, se desactiva la ruta (soft-delete).
- Eliminación: ya está contemplada (cascada a ExternalServiceRoute). Se agrega cascada al ExternalService oculto.
- Servicios ocultos: el prefijo route permite identificarlos y no mostrarlos en el listado de External Services (se puede filtrar en findAll de ExternalServices con WHERE codigo NOT LIKE 'route%').
- No rompe nada existente: External Services wizard sigue funcionando igual.
