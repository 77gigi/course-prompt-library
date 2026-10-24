const ITERATIONS = 600000;
const encoder = new TextEncoder();
const context = encoder.encode('course-prompt-library:77gigi/course-prompt-library:v1');
const encode = bytes => btoa(String.fromCharCode(...bytes));
const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));

async function derive(password, salt, usage) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export async function lockToken(token, password) {
  if (password.length < 8) throw new Error('密码请至少设置 8 位');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context }, await derive(password, salt, 'encrypt'), encoder.encode(token));
  return { version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(encrypted)) };
}

export async function unlockToken(vault, password) {
  try {
    if (vault?.version !== 1) throw new Error('version');
    const salt = decode(vault.salt), iv = decode(vault.iv), ciphertext = decode(vault.ciphertext);
    if (salt.length !== 16 || iv.length !== 12) throw new Error('format');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: context }, await derive(password, salt, 'decrypt'), ciphertext);
    return new TextDecoder().decode(plain);
  } catch { throw new Error('密码不正确，或本机授权记录已损坏'); }
}
