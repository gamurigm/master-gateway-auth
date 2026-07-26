const API = 'http://localhost:3000/api';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'SnSYm36rKIgfnhLRewwoUgCY-H-rEO_h';

async function safeJson(res) {
  try { return await res.json(); }
  catch { return { raw: await res.text() }; }
}

async function run() {
  console.log('=== PRUEBA A: Gateway reconoce "reportes" en whitelist ===');
  const p1 = await fetch(API + '/internals/validate-token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-api-key': INTERNAL_KEY,
      'x-internal-service': 'reportes'
    },
    body: JSON.stringify({ token: 'token-invalido-123' })
  });
  const b1 = await safeJson(p1);
  console.log('Servicio reportes -> Status:', p1.status);
  console.log('Body:', JSON.stringify(b1));
  if (p1.status === 200 && b1.valid === false) {
    console.log('>>> ✅ OK: servicio reportes ESTA en whitelist INTERNAL_ALLOWED_SERVICES');
  } else {
    console.log('>>> ❌ FAIL: servicio NO reconocido (debe ser 200 {valid:false})');
  }
  console.log('');

  console.log('=== PRUEBA B: Gateway RECHAZA servicio "fake-service" (NO whitelist) ===');
  const p2 = await fetch(API + '/internals/validate-token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-api-key': INTERNAL_KEY,
      'x-internal-service': 'fake-service'
    },
    body: JSON.stringify({ token: 'cualquiera' })
  });
  const b2 = await safeJson(p2);
  console.log('fake-service -> Status:', p2.status);
  console.log('Body:', JSON.stringify(b2));
  if (p2.status === 401) {
    console.log('>>> ✅ OK: el gateway bloquea servicios fuera de la whitelist');
  } else {
    console.log('>>> ❌ FAIL: debio bloquear fake-service con 401');
  }
  console.log('');

  console.log('=== FLUJO COMPLETO Login -> Reportes (:3008) ===');
  try {
    const login = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Admin12345!' })
    });
    const lb = await safeJson(login);
    console.log('[1/6] Login Status:', login.status);
    if (!login.ok) { console.log('Login Error:', JSON.stringify(lb)); return; }
    console.log('[1/6] TempToken OK. Roles disponibles:', lb.roles.map(function(r){ return r.name; }).join(', '));
    const superAdmin = lb.roles.find(function(r){ return r.name === 'SUPERADMIN' || r.name === 'ADMIN'; });
    if (!superAdmin) { console.log('ERROR: No hay rol SUPERADMIN/ADMIN'); return; }

    const sel = await fetch(API + '/auth/select-role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tempToken: lb.tempToken, roleId: superAdmin.id })
    });
    const sb = await safeJson(sel);
    console.log('[2/6] SelectRole Status:', sel.status, '-> RoleName:', sb.role ? sb.role.name : null);
    if (!sel.ok) { console.log('Error select-role'); return; }
    const ACCESS = sb.accessToken;

    console.log('[3/6] GET /reportes/financieros (con token ADMIN)...');
    const rep = await fetch('http://localhost:3008/reportes/financieros', {
      headers: { authorization: 'Bearer ' + ACCESS }
    });
    const rb = await safeJson(rep);
    console.log('       Status:', rep.status);
    if (rep.status === 200) {
      console.log('       ✅ OK! Periodo:', rb.report ? rb.report.period : null);
      console.log('       TotalVentas $:', rb.report ? rb.report.totalVentas : null);
      console.log('       RotacionInventario:', rb.report ? rb.report.rotacionInventario : null);
      console.log('       Context userId:', rb.context ? rb.context.userId : null, '| role:', rb.context ? rb.context.roleName : null);
    } else {
      console.log('       ❌ FAIL:', JSON.stringify(rb));
    }

    console.log('');
    console.log('[4/6] GET /reportes/operaciones (con token ADMIN)...');
    const ops = await fetch('http://localhost:3008/reportes/operaciones', {
      headers: { authorization: 'Bearer ' + ACCESS }
    });
    const ob = await safeJson(ops);
    console.log('       Status:', ops.status);
    if (ops.status === 200) {
      console.log('       ✅ OK! Items count:', ob.items ? ob.items.length : null);
      console.log('       Ultima fecha reportada:', ob.items && ob.items[0] ? ob.items[0].date : null);
      console.log('       Monto ultimo dia:', ob.items && ob.items[0] ? ob.items[0].monto : null);
      console.log('       Context role:', ob.context ? ob.context.roleName : null);
    } else {
      console.log('       ❌ FAIL:', JSON.stringify(ob));
    }

    console.log('');
    console.log('[5/6] GET /reportes/financieros SIN token (debe 401)...');
    const sinT = await fetch('http://localhost:3008/reportes/financieros');
    const stb = await safeJson(sinT);
    var res5 = (sinT.status === 401) ? '✅ 401 OK' : '❌ FAIL';
    console.log('       Status:', sinT.status, res5);
    console.log('       Body:', JSON.stringify(stb));

    console.log('');
    var roleVentas = lb.roles.find(function(r){ return r.name === 'VENTAS'; });
    if (roleVentas) {
      console.log('[6/6] GET /reportes/financieros con ROL VENTAS (debe 403)...');
      var sv = await fetch(API + '/auth/select-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tempToken: lb.tempToken, roleId: roleVentas.id })
      });
      var svb = await safeJson(sv);
      if (sv.ok) {
        var conRolV = await fetch('http://localhost:3008/reportes/financieros', {
          headers: { authorization: 'Bearer ' + svb.accessToken }
        });
        var cvb = await safeJson(conRolV);
        var res6 = (conRolV.status === 403) ? '✅ 403 OK' : '❌ FAIL';
        console.log('       Status:', conRolV.status, res6);
        console.log('       Body:', JSON.stringify(cvb));
      }
    } else {
      console.log('[6/6] ⚠ No hay rol VENTAS asignado a admin, se omite prueba 403.');
    }

    console.log('\n=== FIN DE PRUEBAS ===');
  } catch (e) {
    console.error('Exception:', e.message);
  }
}

run().catch(function(e){ console.error('Unhandled:', e); });
