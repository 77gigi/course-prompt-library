import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

const config = { repoOwner: 'teacher', repoName: 'prompt-library', branch: 'main' };
const catalog = [{ id: 'old', slug: 'old', title: '旧模板', status: 'published' }];

function mockGithub() {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'PUT') return { ok: true, json: async () => ({ commit: { sha: 'new' } }) };
    const content = url.includes('ip-series.json') ? JSON.stringify({ id: 'ip-boards', commonPrompt: '共用要求' }) : JSON.stringify(catalog);
    return { ok: true, json: async () => ({ type: 'file', content: Buffer.from(content).toString('base64'), sha: 'original-sha' }) };
  };
  return { calls, fetcher };
}

test('teacher edits require a configured repository and management token', async () => {
  const empty = createApi({}, async () => { throw new Error('must not fetch'); });
  assert.equal(empty.configured, false);
  await assert.rejects(() => empty.upsertEntry('token', { slug: 'a' }), /尚未连接/);
  const api = createApi(config, async () => { throw new Error('must not fetch'); });
  await assert.rejects(() => api.upsertEntry('', { slug: 'a' }), /管理密钥/);
});

test('saving a prompt updates catalog with current SHA and scoped token', async () => {
  const { calls, fetcher } = mockGithub();
  const api = createApi(config, fetcher);
  await api.upsertEntry('teacher-secret', { slug: 'new', title: '新模板', course: '课程', category: '类型', body: '正文', status: 'published' });
  assert.match(calls[0].url, /contents\/src\/data\/catalog.json/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer teacher-secret');
  const write = JSON.parse(calls[1].options.body);
  assert.equal(write.sha, 'original-sha');
  assert.equal(write.branch, 'main');
  const saved = JSON.parse(Buffer.from(write.content, 'base64').toString());
  assert.equal(saved.length, 2);
  assert.equal(saved[0].slug, 'new');
  assert.equal(saved[1].slug, 'old');
});

test('repeat import replaces the same slug without creating duplicates', async () => {
  const { calls, fetcher } = mockGithub();
  const api = createApi(config, fetcher);
  await api.replaceEntries('teacher-secret', [{ slug: 'old', title: '更新模板', status: 'published' }]);
  const write = JSON.parse(calls[1].options.body);
  const saved = JSON.parse(Buffer.from(write.content, 'base64').toString());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].title, '更新模板');
});

test('archive hides a prompt without deleting it', async () => {
  const { calls, fetcher } = mockGithub();
  const api = createApi(config, fetcher);
  await api.archiveEntry('teacher-secret', 'old');
  const write = JSON.parse(calls[1].options.body);
  const saved = JSON.parse(Buffer.from(write.content, 'base64').toString());
  assert.equal(saved[0].status, 'archived');
});
