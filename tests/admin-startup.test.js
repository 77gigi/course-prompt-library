import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('teacher login opens when an older cached page lacks the course rename controls', () => {
  const script = `
    const nodes = new Map();
    globalThis.document = { querySelector(selector) {
      if (selector.startsWith('#rename-course-')) return null;
      if (!nodes.has(selector)) nodes.set(selector, { hidden: true, value: '', addEventListener() {}, elements: { namedItem() { return { addEventListener() {} }; } }, classList: { toggle() {} } });
      return nodes.get(selector);
    }};
    globalThis.window = { PROMPT_LIBRARY_CONFIG: { repoOwner: 'teacher', repoName: 'library' } };
    globalThis.localStorage = { getItem() { return null; } };
    globalThis.sessionStorage = { getItem() { return null; } };
    globalThis.location = { hash: '' };
    await import(${JSON.stringify(new URL('../src/admin.js', import.meta.url).href)});
    await new Promise(resolve => setImmediate(resolve));
    if (nodes.get('#login-panel').hidden) throw new Error('Login was not shown');
    console.log('login shown');
  `;
  assert.match(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }), /login shown/);
});
