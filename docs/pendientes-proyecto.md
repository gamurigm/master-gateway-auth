# Pendientes del Proyecto

Este documento resume lo que aun falta o conviene cerrar en el proyecto Master Gateway, tomando como base el estado actual del repositorio.

## Estado general

El proyecto ya cubre la base funcional principal:

- login con `tempToken`
- seleccion de rol de trabajo
- CRUD de usuarios, roles, modulos y menus
- arbol de navegacion dinamico
- validacion de tokens y control de acceso por rol
- UI administrativa funcional
- despliegue local con Docker

Lo que queda no es la idea central del sistema, sino el cierre de producto: endurecimiento, cobertura, despliegue real y documentacion final.

## 1. Pendientes funcionales

- Autorizacion mas granular por permiso o accion. Hoy el control principal sigue estando centrado en el rol `ADMIN` y en los recursos principales.
- UI de permisos mas completa para asignar y visualizar relaciones con mejor filtrado, busqueda y navegacion.
- Mejor experiencia para rutas dinamicas que no tengan componente especifico; hoy se resuelven con una vista generica.
- Mejor manejo de estados vacios, errores y carga en todas las pantallas, con consistencia total.
- Mas pruebas de flujo extremo en frontend, por ejemplo sesiones expiradas durante navegacion o refresco de token.

## 2. Pendientes de seguridad

- Mover la sesion del frontend desde `localStorage` hacia cookies `HttpOnly` con proteccion CSRF.
- Blacklist o revocacion inmediata de `jti` para access tokens si se requiere invalidacion instantanea.
- Ampliar el control de permisos para no depender solo del rol y poder bloquear acciones concretas por menu o accion.
- Revisar el warning historico de dependencias vulnerables reportado por `npm audit` y decidir si se acepta, se mitiga o se reemplaza la dependencia.
- Fortalecer pruebas de seguridad contra reutilizacion de refresh token, acceso cruzado entre roles y acceso por URL directa.

## 3. Pendientes de CI/CD y despliegue

- Dejar configuradas y probadas las variables y secretos del pipeline en el entorno de destino.
- Confirmar el flujo real de notificaciones por Telegram con tokens validos y chat destino.
- Ejecutar el despliegue en la plataforma elegida con una corrida completa desde CI.
- Si se usa SonarQube local en pipeline, documentar el flujo de salida y la condicion de bloqueo del Quality Gate con evidencia.
- Completar pruebas de integracion y e2e que se ejecuten de forma estable en CI.

## 4. Pendientes de documentacion

- Capturas finales del login, selector de rol, dashboard, asignacion de permisos y vistas CRUD.
- Evidencia del pipeline exitoso.
- Evidencia del despliegue final.
- Documento tecnico de arquitectura mas compacto y final.
- Coleccion HTTP o Postman validada con escenarios de exito y error.
- Cierre del informe final academico con riesgos, decisiones y limitaciones.

## 5. Pendientes de microservicios hijos

- Extender el ejemplo `ventas` con permisos mas granulares y no solo validacion de token base.
- Documentar mejor la estrategia Zero Trust entre Master Gateway y servicios hijos.
- Si se agrega otro hijo, repetir el patron de validacion sin copiar logica de usuarios localmente.

## 6. Prioridad recomendada

1. Cerrar seguridad de sesion y autorizacion granular.
2. Completar pruebas e2e y de seguridad.
3. Ejecutar y documentar despliegue real.
4. Reunir capturas y evidencias.
5. Redactar el informe final y la presentacion.

## 7. Conclusión

El proyecto ya esta en una fase avanzada y funcional. Lo que falta ahora es convertirlo de un sistema que corre localmente a una entrega cerrada, demostrable y bien documentada.
