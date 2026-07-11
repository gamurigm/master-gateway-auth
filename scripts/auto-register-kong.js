#!/usr/bin/env node

/**
 * Script de Auto-Registration para Kong API Gateway
 * Registra automáticamente un servicio en Kong cuando el contenedor se levanta
 */

const http = require('node:http');

// Configuración desde variables de entorno
const config = {
  kongAdminUrl: process.env.KONG_ADMIN_URL || 'http://kong:8001',
  serviceName: process.env.KONG_SERVICE_NAME,
  serviceUrl: process.env.KONG_SERVICE_URL,
  routePaths: (process.env.KONG_ROUTE_PATHS || '').split(',').map(p => p.trim()).filter(Boolean),
  serviceHost: process.env.KONG_SERVICE_HOST || process.env.KONG_SERVICE_NAME,
  servicePort: Number.parseInt(process.env.KONG_SERVICE_PORT) || 3000,
  waitTime: Number.parseInt(process.env.KONG_WAIT_TIME || 30) // segundos
};

// Validar configuración
function validateConfig() {
  const errors = [];
  if (!config.serviceName) errors.push('KONG_SERVICE_NAME es requerida');
  if (!config.serviceUrl) errors.push('KONG_SERVICE_URL es requerida');
  if (config.routePaths.length === 0) errors.push('KONG_ROUTE_PATHS es requerida (ej: /api)');
  
  if (errors.length > 0) {
    console.error('❌ Error de configuración:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

// Esperar a que Kong y el servicio estén listos
async function waitForServices() {
  console.log(`⏳ Esperando ${config.waitTime} segundos para que los servicios estén listos...`);
  await new Promise(resolve => setTimeout(resolve, config.waitTime * 1000));
}

// Hacer petición HTTP
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.kongAdminUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, data: jsonBody });
        } catch (_e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Registrar o actualizar Service en Kong
async function registerService() {
  console.log(`🔍 Verificando si el servicio "${config.serviceName}" en Kong...`);
  
  try {
    const getRes = await request('GET', `/services/${config.serviceName}`);
    
    if (getRes.statusCode === 200) {
      console.log(`✅ Servicio "${config.serviceName}" ya existe. Actualizando...`);
      await request('PATCH', `/services/${config.serviceName}`, {
        name: config.serviceName,
        url: config.serviceUrl
      });
      console.log(`✅ Servicio "${config.serviceName}" actualizado correctamente`);
    } else {
      console.log(`📝 Creando servicio "${config.serviceName}"...`);
      await request('POST', '/services/', {
        name: config.serviceName,
        url: config.serviceUrl
      });
      console.log(`✅ Servicio "${config.serviceName}" creado correctamente`);
    }
  } catch (error) {
    console.error(`❌ Error al registrar servicio: ${error.message}`);
    throw error;
  }
}

// Registrar o actualizar Routes en Kong
async function registerRoutes() {
  console.log(`🔍 Verificando rutas para "${config.serviceName}"...`);
  
  try {
    const routesUrl = `/services/${config.serviceName}/routes`;
    
    // Obtener rutas existentes
    const getRes = await request('GET', routesUrl);
    const existingRoutes = getRes.data?.data || [];
    const existingPaths = new Set(existingRoutes.flatMap(r => r.paths || []));
    
    // Crear rutas nuevas
    for (const path of config.routePaths) {
      if (!existingPaths.has(path)) {
        console.log(`📝 Creando ruta para "${path}"...`);
        await request('POST', routesUrl, {
          name: `${config.serviceName}-route-${path.replaceAll('/', '-')}`,
          paths: [path],
          strip_path: false
        });
        console.log(`✅ Ruta "${path}" creada correctamente`);
      } else {
        console.log(`ℹ️  Ruta "${path}" ya existe, omitiendo...`);
      }
    }
  } catch (error) {
    console.error(`❌ Error al registrar rutas: ${error.message}`);
    throw error;
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando Auto-Registration para Kong...');
  console.log('📋 Configuración:');
  console.log(`  - Kong Admin: ${config.kongAdminUrl}`);
  console.log(`  - Nombre de Servicio: ${config.serviceName}`);
  console.log(`  - URL del Servicio: ${config.serviceUrl}`);
  console.log(`  - Rutas: ${config.routePaths.join(', ')}`);
  console.log('');

  validateConfig();
  await waitForServices();

  try {
    await registerService();
    await registerRoutes();
    console.log('');
    console.log('🎉 Auto-Registration completado exitosamente!');
    console.log('');
    console.log('✅ Servicio registrado en Kong:');
    console.log(`   - Nombre: ${config.serviceName}`);
    const routeLines = config.routePaths
      .map(p => `   - http://localhost:8000${p}/*`)
      .join('\n');
    console.log(`   - Rutas:\n${routeLines}`);
  } catch (error) {
    console.error('❌ Error en Auto-Registration:', error);
    process.exit(1);
  }
}

// Ejecutar
main().catch(console.error);
