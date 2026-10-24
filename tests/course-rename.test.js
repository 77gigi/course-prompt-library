import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

test('renaming updates all course entries in one write, preserves other data, and prevents merging courses', async () => {
  const original = [{ slug: 'a', course: '旧课程', status: 'published', imagePath: 'a.enc' }, { slug: 'b', course: '旧课程', status: 'draft' }, { slug: 'c', course: '其他课程' }];
  const writes = [];
  const api = createApi({ repoOwner: 'teacher', repoName: 'library' }, async (_, options) => {
    if (options.method === 'PUT') { writes.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({ type: 'file', sha: 'current-sha', content: Buffer.from(JSON.stringify(original)).toString('base64') }) };
  });
  assert.equal(await api.renameCourse('test-token', '旧课程', ' 新课程 '), 2);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].sha, 'current-sha');
  const saved = JSON.parse(Buffer.from(writes[0].content, 'base64').toString());
  assert.deepEqual(saved, original.map(item => item.course === '旧课程' ? { ...item, course: '新课程' } : item));
  await assert.rejects(api.renameCourse('test-token', '旧课程', '其他课程'), /同名课程/);
  await assert.rejects(api.renameCourse('test-token', '不存在', '新课程'), /找不到/);
  assert.equal(writes.length, 1);
});
