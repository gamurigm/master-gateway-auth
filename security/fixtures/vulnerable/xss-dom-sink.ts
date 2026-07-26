// FIXTURE VULNERABLE - CWE-79 (Cross-site Scripting) - OWASP 2025 A05
// Regla esperada: TS-XSS
// NO USAR EN PRODUCCION.

export function renderMenuLabel(container: HTMLElement, label: string) {
  // El label proviene de la base de datos y puede contener markup del atacante.
  container.innerHTML = `<span class="menu-label">${label}</span>`;
}

export function renderWelcome(target: HTMLElement, userName: string) {
  target.innerHTML = 'Bienvenido ' + userName;
}
