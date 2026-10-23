import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog.json'), 'utf8'));

test('published templates have stable identifiers, readable fields and matching example files', () => {
  assert.equal(catalog.length, 43);
  assert.equal(new Set(catalog.map(row => row.slug)).size, catalog.length);
  assert.equal(catalog.filter(row => row.imagePath).length, 37);
  for (const row of catalog) {
    assert.equal(row.status, 'published');
    for (const key of ['slug', 'course', 'category', 'title', 'body']) assert.ok(row[key]?.trim(), `${row.slug}: ${key}`);
    if (row.imagePath) {
      assert.match(row.imagePath, /\.enc$/, `${row.slug}: image must be encrypted`);
      assert.ok(existsSync(join(root, row.imagePath)), `${row.slug}: image missing`);
    }
  }
});

test('six IP board themes follow the final teaching order and share one common rule', () => {
  const ip = catalog.filter(row => row.seriesId === 'ip-boards');
  assert.deepEqual(ip.map(row => row.title), [
    'IP 主视觉', '角色设定与三视图', '动作与表情', '系列插画', '文创衍生应用', '整体成果总览',
  ]);
  const series = JSON.parse(readFileSync(join(root, 'src/data/ip-series.json'), 'utf8'));
  assert.equal(series.id, 'ip-boards');
  assert.match(series.commonPrompt, /不编造/);
});
