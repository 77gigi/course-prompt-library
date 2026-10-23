import test from 'node:test';
import assert from 'node:assert/strict';
import { validateName, filterEntries, composePrompt, makeSeedRows } from '../src/catalog.js';

test('name entry rejects whitespace and accepts a real filled string', () => {
  assert.equal(validateName('  '), false);
  assert.equal(validateName('张同学'), true);
});

test('search matches mixed Chinese and Latin text across fields', () => {
  const entries = [
    { title: 'IP三视图', category: '角色', course: '动漫3AI数字绘画', prompt: 'front view 正面' },
    { title: '宝石材质', category: '材质', course: '动漫3AI数字绘画', prompt: '透明刻面' },
  ];
  assert.equal(filterEntries(entries, '  FRONT 正面 ', '动漫3AI数字绘画', '角色').length, 1);
  assert.equal(filterEntries(entries, '宝石', '', '').length, 1);
  assert.equal(filterEntries(entries, '', '其他课程', '').length, 0);
});

test('copying an IP theme contains common rules exactly once', () => {
  const entry = { title: '角色设定与三视图', body: '按正面、侧面、背面排列。', seriesId: 'ip-boards' };
  const series = { id: 'ip-boards', commonPrompt: '只使用提供的原创素材。' };
  const result = composePrompt(entry, series);
  assert.equal(result.match(/只使用提供的原创素材/g)?.length, 1);
  assert.match(result, /角色设定与三视图/);
  assert.match(result, /按正面、侧面、背面排列/);
});

test('starter rows have stable unique slugs for idempotent import', () => {
  const seed = [{ id: 'digital-painting-002', title: 'A' }, { id: 'ip-board-01', title: 'B' }];
  assert.deepEqual(makeSeedRows(seed).map(x => x.slug), ['digital-painting-002', 'ip-board-01']);
  assert.throws(() => makeSeedRows([...seed, seed[0]]), /重复/);
});
