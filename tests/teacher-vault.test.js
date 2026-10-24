import test from 'node:test';
import assert from 'node:assert/strict';
import { lockToken, unlockToken } from '../src/teacher-vault.js';

test('local vault recovers the credential and rejects wrong passwords and modified ciphertext', async () => {
  const token = 'test-only-credential';
  const vault = await lockToken(token, 'test-only-password');
  assert.equal(JSON.stringify(vault).includes(token), false);
  assert.equal(await unlockToken(vault, 'test-only-password'), token);
  await assert.rejects(unlockToken(vault, 'wrong-password'), /密码不正确/);
  const damaged = { ...vault, ciphertext: (vault.ciphertext[0] === 'A' ? 'B' : 'A') + vault.ciphertext.slice(1) };
  await assert.rejects(unlockToken(damaged, 'test-only-password'), /密码不正确/);
});
