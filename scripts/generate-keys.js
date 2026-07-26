const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { generateKeyPairSync } = require('crypto');
const { resolve } = require('path');

const keysDir = process.env.KEYS_DIR || resolve(__dirname, '..', 'backend', 'keys');
const privPath = resolve(keysDir, 'private.pem');
const pubPath = resolve(keysDir, 'public.pem');

if (existsSync(privPath) && existsSync(pubPath)) {
  console.log('[generate-keys] RSA key pair already exists, skipping.');
  process.exit(0);
}

console.log('[generate-keys] Generating RSA 4096 key pair...');
mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privPath, privateKey, { mode: 0o600 });
writeFileSync(pubPath, publicKey, { mode: 0o644 });

console.log(`[generate-keys] RSA key pair written to:
  Private: ${privPath}
  Public:  ${pubPath}`);
