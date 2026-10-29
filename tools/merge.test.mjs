import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// dist/ 是瀏覽器用的 ES module，這裡用 data URL 載入以避開 package.json 的 commonjs 設定
const src = readFileSync(new URL('../dist/merge.js', import.meta.url), 'utf8');
const { mergeStates, toCloud, fromCloud } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const c = (last, n = 1, due = '2026-11-01') => ({ ef: 2.5, iv: 3, due, n, lapses: 0, last, first: '2026-10-01' });
const local = { nickname: '小美', settingsAt: 200, settings: { dailyNew: 20, theme: 'dark' },
  cards: { 'tel-0001': c('2026-10-28'), 'tel-0002': c('2026-10-20'), 'net-0001': c('2026-10-25', 2) },
  days: { '2026-10-28': { new: 5, rev: 3 } } };
const remote = fromCloud(toCloud({ nickname: '阿美', settingsAt: 100, settings: { dailyNew: 30, theme: 'light' },
  cards: { 'tel-0001': c('2026-10-27'), 'tel-0002': c('2026-10-26'), 'cus-0001': c('2026-10-10'), 'net-0001': c('2026-10-25', 3) },
  days: { '2026-10-28': { new: 2, rev: 9 }, '2026-10-27': { new: 1, rev: 0 } } }));
let m = mergeStates(local, remote);
assert.equal(m.cards['tel-0001'].last, '2026-10-28');   // local newer
assert.equal(m.cards['tel-0002'].last, '2026-10-26');   // remote newer
assert.ok(m.cards['cus-0001']);                         // remote-only kept
assert.equal(m.cards['net-0001'].n, 3);                 // same day → more reps
assert.equal(m.nickname, '小美'); assert.equal(m.settings.dailyNew, 20); // local settings newer
assert.deepEqual(m.days['2026-10-28'], { new: 5, rev: 9 });
assert.ok(m.days['2026-10-27']);
m = mergeStates({ ...local, settingsAt: 50 }, remote);
assert.equal(m.nickname, '阿美'); assert.equal(m.settings.theme, 'light'); assert.equal(m.settingsAt, 100);
assert.equal(mergeStates(local, null), local);
// round-trip & size
const big = { cards: {}, days: {}, settings: {} };
for (let i = 0; i < 4100; i++) big.cards['tel-' + String(i).padStart(4, '0')] = c('2026-10-28');
const size = JSON.stringify(toCloud(big)).length;
assert.ok(size < 400000, 'size ' + size);
assert.deepEqual(fromCloud(toCloud(big)).cards['tel-0005'], big.cards['tel-0005']);
console.log('merge tests passed; 4100-card doc ≈', Math.round(size / 1024), 'KB');
