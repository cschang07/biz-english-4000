/* 雲端同步的合併邏輯（純函式，可在 Node 單元測試）。
   本機格式：{ nickname, settings, settingsAt, cards: {id: {ef,n,iv,lapses,due,last,first}}, days: {ymd: {new,rev}} }
   雲端格式：{ nickname, settings, settingsAt, days, cards: {id: [ef, iv, due, n, lapses, last, first]}, updatedAt } */

export function packCard(c) {
  return [c.ef, c.iv, c.due, c.n, c.lapses || 0, c.last, c.first || c.last];
}
export function unpackCard(a) {
  if (!Array.isArray(a) || a.length < 6) return null;
  return { ef: a[0], iv: a[1], due: a[2], n: a[3], lapses: a[4], last: a[5], first: a[6] || a[5] };
}

export function toCloud(s) {
  const cards = {};
  for (const id of Object.keys(s.cards || {})) cards[id] = packCard(s.cards[id]);
  return {
    nickname: s.nickname || '',
    settings: s.settings || {},
    settingsAt: Number(s.settingsAt) || 0,
    days: s.days || {},
    cards,
    updatedAt: Date.now(),
  };
}

export function fromCloud(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const cards = {};
  const raw = doc.cards && typeof doc.cards === 'object' ? doc.cards : {};
  for (const id of Object.keys(raw)) {
    const c = unpackCard(raw[id]);
    if (c) cards[id] = c;
  }
  return {
    nickname: typeof doc.nickname === 'string' ? doc.nickname : '',
    settings: doc.settings && typeof doc.settings === 'object' ? doc.settings : {},
    settingsAt: Number(doc.settingsAt) || 0,
    days: doc.days && typeof doc.days === 'object' ? doc.days : {},
    cards,
  };
}

// 同一張卡：lastReview（YYYY-MM-DD）較新者勝；同一天則複習次數多者、再來到期日較晚者勝
function newerCard(a, b) {
  if (!a) return b;
  if (!b) return a;
  const la = String(a.last || ''), lb = String(b.last || '');
  if (la !== lb) return la > lb ? a : b;
  if ((a.n || 0) !== (b.n || 0)) return (a.n || 0) > (b.n || 0) ? a : b;
  if ((a.lapses || 0) !== (b.lapses || 0)) return (a.lapses || 0) > (b.lapses || 0) ? a : b;
  return String(a.due || '') >= String(b.due || '') ? a : b;
}

// opts.preferRemoteSettings：本機還在首次引導（尚未完成），本機的暱稱／設定只是預設值或剛輸入的，
// 不能憑較新的 settingsAt 蓋掉雲端既有答案，也不能讓本機 onboarded:false 蓋掉雲端的 true。
export function mergeStates(local, remote, opts = {}) {
  if (!remote) return local;
  const L = local || {};
  const remoteWins = !!opts.preferRemoteSettings || (Number(remote.settingsAt) || 0) > (Number(L.settingsAt) || 0);
  const out = {
    ...L,
    nickname: remoteWins ? (remote.nickname || L.nickname || '') : (L.nickname || remote.nickname || ''),
    settings: remoteWins ? { ...(L.settings || {}), ...remote.settings } : { ...(remote.settings || {}), ...(L.settings || {}) },
    settingsAt: Math.max(Number(L.settingsAt) || 0, Number(remote.settingsAt) || 0),
    cards: {},
    days: {},
  };
  if ((L.settings && L.settings.onboarded) || (remote.settings && remote.settings.onboarded)) out.settings.onboarded = true;
  const lc = L.cards || {}, rc = remote.cards || {};
  for (const id of new Set([...Object.keys(lc), ...Object.keys(rc)])) out.cards[id] = newerCard(lc[id], rc[id]);
  // 每日統計（連續天數用）：同一天取較大值
  const ld = L.days || {}, rd = remote.days || {};
  for (const k of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const a = ld[k] || {}, b = rd[k] || {};
    out.days[k] = { new: Math.max(Number(a.new) || 0, Number(b.new) || 0), rev: Math.max(Number(a.rev) || 0, Number(b.rev) || 0) };
  }
  return out;
}
