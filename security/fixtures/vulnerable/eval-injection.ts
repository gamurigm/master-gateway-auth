// FIXTURE VULNERABLE - CWE-95 (Eval Injection) - OWASP 2025 A05
// Regla esperada: TS-EVAL
// NO USAR EN PRODUCCION.

export function applyMenuFilter(expression: string, menus: unknown[]) {
  // Evalua una expresion enviada por el cliente para filtrar el arbol de menus.
  const predicate = eval(`(node) => ${expression}`);
  return menus.filter(predicate);
}

export function buildFormatter(template: string) {
  return new Function('data', `return \`${template}\`;`);
}
