const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: No se encontró el archivo .env');
  process.exit(1);
}

// Parse .env manually to avoid extra dependencies
const env = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      acc[key] = value.trim();
    }
    return acc;
  }, {});

const apiKey = env.RENDER_API_KEY;
const serviceId = env.RENDER_SERVICE_ID;

if (!apiKey || !serviceId) {
  console.error('Error: RENDER_API_KEY y RENDER_SERVICE_ID deben estar definidos en el archivo .env');
  process.exit(1);
}

console.log(`Iniciando despliegue para el servicio: ${serviceId}...`);

// Encontrar el binario de render
let command = '';
try {
  // Intentar correr en Windows
  execSync('render --version', { stdio: 'ignore' });
  command = `render deploys create ${serviceId} --confirm --wait`;
} catch {
  // Intentar correr vía WSL (ya que sabemos que está en ~/.local/bin/render)
  try {
    const home = execSync('wsl echo $HOME', { encoding: 'utf8' }).trim();
    const wslRenderBin = `${home}/.local/bin/render`;
    execSync(`wsl ${wslRenderBin} --version`, { stdio: 'ignore' });
    command = `wsl RENDER_API_KEY=${apiKey} ${wslRenderBin} deploys create ${serviceId} --confirm --wait`;
  } catch (err) {
    console.error('Error: No se encontró la herramienta render CLI en el host ni en WSL.');
    console.error('Por favor instala render CLI corriendo: wsl curl -fsSL https://raw.githubusercontent.com/render-oss/cli/main/bin/install.sh | sh');
    process.exit(1);
  }
}

try {
  execSync(command, {
    env: { ...process.env, RENDER_API_KEY: apiKey },
    stdio: 'inherit'
  });
  console.log('¡Despliegue completado con éxito!');
} catch (error) {
  console.error('Error durante el despliegue.');
  process.exit(1);
}
