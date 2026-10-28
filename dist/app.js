/* 商用英文 4000 — 純 JavaScript，無需建置工具 */
(() => {
  'use strict';

  const APP_VERSION = '1.0.0';
  const STORE_KEY = 'biz4000.v1';

  const CATS = [
    { key: 'telecom',  zh: '通訊電信',         prefix: 'tel', target: 900, color: '#4c6ef5' },
    { key: 'network',  zh: '網路與技術',       prefix: 'net', target: 500, color: '#1098ad' },
    { key: 'customer', zh: '客戶溝通',         prefix: 'cus', target: 450, color: '#f76707' },
    { key: 'contract', zh: '合約法務',         prefix: 'con', target: 400, color: '#7048e8' },
    { key: 'meeting',  zh: '會議簡報',         prefix: 'mtg', target: 400, color: '#0ca678' },
    { key: 'email',    zh: 'Email 與書信用語', prefix: 'eml', target: 450, color: '#d6336c' },
    { key: 'project',  zh: '專案與營運',       prefix: 'prj', target: 400, color: '#f59f00' },
    { key: 'finance',  zh: '財務採購',         prefix: 'fin', target: 300, color: '#37b24d' },
    { key: 'core',     zh: '通用商務核心',     prefix: 'cor', target: 200, color: '#868e96' },
  ];
  const CAT = Object.fromEntries(CATS.map((c, i) => [c.key, { ...c, order: i }]));
  const LEVEL_ZH = { 1: '基礎', 2: '中級', 3: '進階' };
  const CARD_ID_RE = /^(?:tel|net|cus|con|mtg|eml|prj|fin|cor)-\d{4}$/;
  const MAX_EF = 4;
  const MAX_IV = 36500;

  // SM-2 品質分數：忘記 < 3 視為答錯
  const GRADES = [
    { key: 'again', zh: '忘記', q: 1 },
    { key: 'hard',  zh: '困難', q: 3 },
    { key: 'good',  zh: '良好', q: 4 },
    { key: 'easy',  zh: '簡單', q: 5 },
  ];
  const GRADE = Object.fromEntries(GRADES.map(g => [g.key, g]));
  const MASTERED_DAYS = 21;
  const DRILL_GAP = 4; // 忘記的字在同一輪中隔幾張再出現

  const DEFAULT_SETTINGS = {
    onboarded: false,
    dailyNew: 20,
    cats: ['telecom'],
    theme: 'auto',
    autoSpeak: false,
    rate: 0.9,
  };

  /* ---------- 小工具 ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const localYMD = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYMD = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const addDays = (s, n) => {
    const t = new Date(parseYMD(s) + n * 86400000);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  };
  const isValidYMD = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

  let todayOverride = null;
  const today = () => todayOverride || localYMD();

  const fmtDateZh = s => {
    const d = new Date(parseYMD(s));
    return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日 週${'日一二三四五六'[d.getUTCDay()]}`;
  };
  const fmtIv = days => {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 30) return `${Math.max(0, Math.round(Number.isFinite(n) ? n : 0))} 天`;
    if (n < 365) return `${Math.round(n / 3) / 10} 個月`;
    return `${Math.round(n / 36.5) / 10} 年`;
  };

  const ICON = {
    speak: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
    fire: '<svg viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-6.2-4-8-.4 2-1.5 3.2-3 4-.2-3-1.8-5.7-4-7 .2 3.4-3 6-3 11 0 4.2 3 7 7 7z"/></svg>',
    stack: '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  };

  /* ---------- 儲存 ---------- */
  function freshState() {
    return {
      version: 1,
      settings: { ...DEFAULT_SETTINGS, cats: DEFAULT_SETTINGS.cats.slice() },
      cards: Object.create(null),
      days: Object.create(null),
    };
  }
  function plainObject(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v;
  }
  function sanitizeCard(id, raw) {
    if (!CARD_ID_RE.test(id) || !plainObject(raw)) return null;
    const ef = Number(raw.ef);
    const n = Number(raw.n);
    const iv = Number(raw.iv);
    if (!Number.isFinite(ef) || !Number.isFinite(n) || !Number.isFinite(iv)) return null;
    if (typeof raw.due !== 'string' || !isValidYMD(raw.due)) return null;
    const last = typeof raw.last === 'string' && isValidYMD(raw.last) ? raw.last : raw.due;
    const first = typeof raw.first === 'string' && isValidYMD(raw.first) ? raw.first : last;
    const lapses = Number(raw.lapses);
    return {
      ef: clamp(Math.round(ef * 1000) / 1000, 1.3, MAX_EF),
      n: clamp(Math.round(n), 0, 10000),
      iv: clamp(Math.round(iv), 0, MAX_IV),
      lapses: clamp(Number.isFinite(lapses) ? Math.round(lapses) : 0, 0, 100000),
      due: raw.due,
      last,
      first,
    };
  }
  function normalizeState(raw) {
    const s = freshState();
    if (!plainObject(raw)) return s;
    const rawS = plainObject(raw.settings);
    if (rawS) {
      if (rawS.onboarded === true) s.settings.onboarded = true;
      if (rawS.autoSpeak === true) s.settings.autoSpeak = true;
      const daily = Number(rawS.dailyNew);
      s.settings.dailyNew = clamp(Number.isFinite(daily) && daily > 0 ? daily : 20, 5, 100);
      const rate = Number(rawS.rate);
      s.settings.rate = clamp(Number.isFinite(rate) ? rate : 0.9, 0.5, 1.3);
      if (Array.isArray(rawS.cats)) {
        const cats = [];
        for (const k of rawS.cats) {
          if (typeof k === 'string' && CAT[k] && !cats.includes(k)) cats.push(k);
        }
        if (cats.length) s.settings.cats = CATS.map(c => c.key).filter(k => cats.includes(k));
      }
      if (rawS.theme === 'auto' || rawS.theme === 'light' || rawS.theme === 'dark') s.settings.theme = rawS.theme;
    }
    const rawCards = plainObject(raw.cards);
    if (rawCards) {
      let n = 0;
      for (const id of Object.keys(rawCards)) {
        if (n >= 8000) break;
        const card = sanitizeCard(id, rawCards[id]);
        if (!card) continue;
        s.cards[id] = card;
        n++;
      }
    }
    const rawDays = plainObject(raw.days);
    if (rawDays) {
      let n = 0;
      for (const k of Object.keys(rawDays)) {
        if (n >= 5000) break;
        if (!isValidYMD(k)) continue;
        const d = rawDays[k];
        if (!plainObject(d)) continue;
        const nw = Number(d.new);
        const rv = Number(d.rev);
        s.days[k] = {
          new: clamp(Number.isFinite(nw) ? Math.round(nw) : 0, 0, 100000),
          rev: clamp(Number.isFinite(rv) ? Math.round(rv) : 0, 0, 100000),
        };
        n++;
      }
    }
    return s;
  }
  function loadState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORE_KEY))); }
    catch (e) { return freshState(); }
  }
  let state = loadState();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('無法儲存進度（儲存空間不足或被瀏覽器封鎖）'); }
  }

  /* ---------- 資料 ---------- */
  let DATA = [];
  let BY_ID = new Map();
  let NEW_ORDER = [];
  const catTotal = {};

  function indexData(arr) {
    DATA = arr.filter(w => w && w.id && w.en && w.zh && CAT[w.category]);
    BY_ID = new Map(DATA.map(w => [w.id, w]));
    CATS.forEach(c => { catTotal[c.key] = 0; });
    const posInCat = {};
    const sorted = DATA.slice().sort((a, b) => CAT[a.category].order - CAT[b.category].order || a.id.localeCompare(b.id));
    sorted.forEach(w => {
      catTotal[w.category]++;
      posInCat[w.id] = catTotal[w.category];
    });
    // 新字順序：先依難度，同難度下各分類輪流出字
    NEW_ORDER = sorted.slice().sort((a, b) =>
      (a.level || 1) - (b.level || 1) || posInCat[a.id] - posInCat[b.id] || CAT[a.category].order - CAT[b.category].order
    );
  }

  /* ---------- SM-2 排程 ---------- */
  // 原版 SM-2：答錯（q<3）重設次數、不改易度；答對依 EF 拉長間隔。
  // 微調：「困難」間隔成長較慢、「簡單」較快，讓四個按鈕有實際差別。
  function schedule(prev, gradeKey, day = today()) {
    const g = GRADE[gradeKey];
    if (!g || !isValidYMD(day)) throw new Error('schedule: 評分或日期無效');
    const q = g.q;
    const priorN = prev && Number.isFinite(Number(prev.n)) ? Math.round(Number(prev.n)) : 0;
    const c = {
      ef: prev && Number.isFinite(Number(prev.ef)) ? Number(prev.ef) : 2.5,
      n: Math.max(0, priorN),
      iv: prev && Number.isFinite(Number(prev.iv)) ? Number(prev.iv) : 0,
      lapses: prev && Number.isFinite(Number(prev.lapses)) ? Math.round(Number(prev.lapses)) : 0,
      first: prev && typeof prev.first === 'string' && isValidYMD(prev.first) ? prev.first : day,
    };
    if (c.ef < 1.3 || c.ef > MAX_EF) c.ef = 2.5;
    if (c.iv < 0) c.iv = 0;
    if (q < 3) {
      if (prev && c.n > 0) c.lapses += 1;
      c.n = 0;
      c.iv = 1;
    } else {
      let iv;
      if (c.n === 0) iv = gradeKey === 'easy' ? 4 : 1;
      else if (c.n === 1) iv = gradeKey === 'hard' ? 3 : gradeKey === 'easy' ? 8 : 6;
      else if (gradeKey === 'hard') iv = Math.max(c.iv + 1, c.iv * 1.2);
      else if (gradeKey === 'easy') iv = c.iv * c.ef * 1.3;
      else iv = c.iv * c.ef;
      const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
      const ef = c.ef + delta;
      c.ef = clamp(Math.round((Number.isFinite(ef) ? ef : 2.5) * 1000) / 1000, 1.3, MAX_EF);
      c.iv = clamp(Math.round(Number.isFinite(iv) ? iv : 1), 1, MAX_IV);
      c.n += 1;
    }
    c.lapses = clamp(c.lapses, 0, 100000);
    c.due = addDays(day, c.iv);
    c.last = day;
    return c;
  }

  const statusOf = id => {
    const c = state.cards[id];
    if (!c) return 'new';
    return Number(c.iv) >= MASTERED_DAYS ? 'mastered' : 'learning';
  };
  const STATUS_ZH = { new: '未學', learning: '學習中', mastered: '熟練' };

  function dayStat(d = today()) { return state.days[d] || { new: 0, rev: 0 }; }
  function bumpDay(kind) {
    const t = today();
    let d = state.days[t];
    if (!d || typeof d !== 'object') d = state.days[t] = { new: 0, rev: 0 };
    d[kind] = (Number(d[kind]) || 0) + 1;
  }
  const active = d => {
    const s = state.days[d];
    return !!s && ((Number(s.new) || 0) + (Number(s.rev) || 0)) > 0;
  };
  function streak() {
    let d = today();
    if (!active(d)) d = addDays(d, -1);
    let n = 0;
    while (active(d) && n < 10000) { n++; d = addDays(d, -1); }
    return n;
  }

  // 已學過的字不論分類都會排入複習；新字只從選擇的分類出
  function dueIds() {
    const t = today();
    return Object.keys(state.cards)
      .filter(id => {
        const c = state.cards[id];
        return BY_ID.has(id) && c && typeof c.due === 'string' && c.due <= t;
      })
      .sort((a, b) => state.cards[a].due.localeCompare(state.cards[b].due));
  }
  function availableNew(limit) {
    const sel = new Set(state.settings.cats);
    const out = [];
    for (const w of NEW_ORDER) {
      if (out.length >= limit) break;
      if (sel.has(w.category) && !state.cards[w.id]) out.push(w.id);
    }
    return out;
  }
  const newLeftToday = () => Math.max(0, state.settings.dailyNew - dayStat().new);

  function todayPlan() {
    const ds = dayStat();
    const due = dueIds().length;
    const newLeft = availableNew(newLeftToday()).length;
    const done = ds.new + ds.rev;
    const total = done + due + newLeft;
    return { ds, due, newLeft, done, total, pct: total ? done / total : 1 };
  }

  /* ---------- 語音 ---------- */
  const TTS = {
    ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    voice: null,
    pick() {
      if (!this.ok) return;
      const vs = speechSynthesis.getVoices();
      this.voice =
        vs.find(v => v.lang === 'en-US' && /Samantha|Google US English|Aria|Jenny|Ava|Allison/i.test(v.name)) ||
        vs.find(v => /^en[-_]US$/i.test(v.lang)) ||
        vs.find(v => /^en/i.test(v.lang)) || null;
    },
    speak(text) {
      if (!this.ok) { toast('此瀏覽器不支援語音朗讀'); return; }
      const utter = String(text || '').trim();
      if (!utter) return;
      const run = () => {
        try {
          const u = new SpeechSynthesisUtterance(utter);
          u.lang = 'en-US';
          u.rate = Number(state.settings.rate) || 0.9;
          if (!this.voice) this.pick();
          if (this.voice) u.voice = this.voice;
          let kick;
          const stopKick = () => { if (kick) clearInterval(kick); kick = null; };
          // iOS 會在朗讀約十餘秒後暫停，需週期性 resume
          u.onstart = () => {
            try { speechSynthesis.resume(); } catch (e) {}
            kick = setInterval(() => {
              if (!speechSynthesis.speaking) { stopKick(); return; }
              try { speechSynthesis.resume(); } catch (e) {}
            }, 4000);
          };
          u.onend = stopKick;
          u.onerror = e => {
            stopKick();
            const code = e && e.error;
            if (code === 'interrupted' || code === 'canceled' || code === 'not-allowed') return;
            toast('語音播放失敗');
          };
          speechSynthesis.speak(u);
        } catch (e) { toast('語音播放失敗'); }
      };
      try {
        // iOS 在同一個回合先 cancel 再 speak 會把這句丟掉
        if (speechSynthesis.speaking || speechSynthesis.pending) {
          speechSynthesis.cancel();
          setTimeout(run, 50);
        } else run();
      } catch (e) { toast('語音播放失敗'); }
    },
  };
  if (TTS.ok) {
    TTS.pick();
    speechSynthesis.addEventListener?.('voiceschanged', () => TTS.pick());
  }

  /* ---------- 主題 ---------- */
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const effectiveTheme = () => state.settings.theme === 'auto' ? (prefersDark.matches ? 'dark' : 'light') : state.settings.theme;
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const eff = effectiveTheme();
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
      if (t === 'auto') m.setAttribute('content', m.media.includes('dark') ? '#101218' : '#f6f4ef');
      else m.setAttribute('content', eff === 'dark' ? '#101218' : '#f6f4ef');
    });
    $('#themeBtn').innerHTML = eff === 'dark' ? ICON.sun : ICON.moon;
    $('#themeBtn').setAttribute('aria-label', eff === 'dark' ? '切換為淺色' : '切換為深色');
  }
  if (prefersDark.addEventListener) prefersDark.addEventListener('change', applyTheme);
  else if (prefersDark.addListener) prefersDark.addListener(applyTheme);

  /* ---------- Toast / 對話框 ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function confirmBox({ title, body = '', ok = '確定', cancel = '取消', danger = false }) {
    return new Promise(resolve => {
      const root = $('#modal');
      root.innerHTML = `
        <div class="modal-backdrop" data-close="0">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
            <h3 id="mTitle">${esc(title)}</h3>
            ${body ? `<p>${esc(body)}</p>` : ''}
            <div class="row">
              <button class="btn ghost" data-close="0" type="button">${esc(cancel)}</button>
              <button class="btn ${danger ? 'danger' : 'primary'}" data-close="1" type="button">${esc(ok)}</button>
            </div>
          </div>
        </div>`;
      const done = v => { root.innerHTML = ''; document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      document.addEventListener('keydown', onKey, true);
      root.firstElementChild.addEventListener('click', e => {
        const t = e.target.closest('[data-close]');
        if (!t || (t.classList.contains('modal-backdrop') && e.target !== t)) return;
        done(t.dataset.close === '1');
      });
      root.querySelector('[data-close="1"]').focus();
    });
  }

  /* ---------- 共用片段 ---------- */
  const catChip = key => `<span class="chip" style="--c:${CAT[key].color}"><span class="dot"></span>${esc(CAT[key].zh)}</span>`;
  const levelDots = lv => `<span class="lvl" title="${LEVEL_ZH[lv] || ''}">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')} ${LEVEL_ZH[lv] || ''}</span>`;
  const speakBtn = (text, small = false) =>
    `<button class="speak${small ? ' sm' : ''}" type="button" data-act="speak" data-text="${esc(text)}" aria-label="朗讀"${TTS.ok ? '' : ' disabled title="此瀏覽器不支援語音"'}>${ICON.speak}</button>`;
  function highlight(text, term) {
    if (!term) return esc(text);
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + term.length)) + '</mark>' + esc(text.slice(i + term.length));
  }
  const exampleBlock = w => w.example_en ? `
    <div class="example">
      <div class="txt">
        <div class="ex-en">${highlight(w.example_en, w.en.replace(/[.。!?]+$/, ''))}</div>
        <div class="ex-zh">${esc(w.example_zh)}</div>
      </div>
      ${speakBtn(w.example_en, true)}
    </div>` : '';

  /* ---------- 路由 ---------- */
  const view = () => $('#view');
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return h || 'home';
  }
  function setChrome(tab, hideTabbar) {
    document.body.classList.toggle('no-tabbar', !!hideTabbar);
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  }

  function render() {
    if (!DATA.length && !loadError) return;
    if (loadError) return renderError();
    if (!state.settings.onboarded) return renderOnboarding();
    const r = route();
    const map = { home: renderHome, study: renderStudy, quiz: renderQuiz, browse: renderBrowse, settings: renderSettings, about: renderAbout };
    (map[r] || renderHome)();
  }
  function paint(html, tab, hideTabbar = false) {
    setChrome(tab, hideTabbar);
    view().innerHTML = html;
  }

  /* ---------- 引導 ---------- */
  let obStep = 0;
  function renderOnboarding() {
    const s = state.settings;
    const steps = `<div class="steps">${[0, 1, 2].map(i => `<i class="${i <= obStep ? 'on' : ''}"></i>`).join('')}</div>`;
    let body = '';
    if (obStep === 0) {
      body = `
        <div class="welcome-art" aria-hidden="true">
          <div class="c c1 en">5G</div><div class="c c2 en">agenda</div><div class="c c3 en">roaming</div>
        </div>
        <h1>歡迎使用<br>商用英文 4000</h1>
        <p class="lead">專為電信產業上班族設計的商務英文單字卡，每天幾分鐘，穩穩累積。</p>
        <div class="body feature-list">
          <div class="feature"><div class="ic">📡</div><div><b>通訊電信為主</b><span>涵蓋網路技術、客戶溝通、合約、會議與 Email。</span></div></div>
          <div class="feature"><div class="ic">🧠</div><div><b>間隔重複複習</b><span>依你的記憶狀況安排複習時間，記得越牢間隔越長。</span></div></div>
          <div class="feature"><div class="ic">🔊</div><div><b>美式英語發音</b><span>點一下就朗讀單字與例句，使用裝置內建語音。</span></div></div>
        </div>`;
    } else if (obStep === 1) {
      const opts = [5, 10, 20, 30, 50];
      const label = { 5: '輕鬆', 10: '穩定', 20: '推薦', 30: '積極', 50: '衝刺' };
      body = `
        <h1>每天學幾個新字？</h1>
        <p class="lead">之後可以隨時在「設定」調整。複習量會依你學過的字自動安排。</p>
        <div class="body">
          <div class="goal-pick">
            ${opts.map(n => `<button type="button" class="${s.dailyNew === n ? 'on' : ''}" data-act="ob-goal" data-n="${n}">${n}<small>${label[n]}</small></button>`).join('')}
          </div>
          <p class="muted" style="margin-top:16px;font-size:14px">每天 ${s.dailyNew} 個新字，大約需要 ${Math.max(5, Math.round(s.dailyNew * 0.8))}–${Math.round(s.dailyNew * 1.5) + 5} 分鐘（含複習）。</p>
        </div>`;
    } else {
      body = `
        <h1>選擇學習分類</h1>
        <p class="lead">建議先從「通訊電信」開始，熟悉後再加入其他分類。</p>
        <div class="body">${catPicker('ob-cat')}</div>`;
    }
    const foot = `
      <div class="foot">
        ${obStep > 0 ? '<button class="btn ghost" type="button" data-act="ob-back">上一步</button>' : ''}
        <button class="btn primary" type="button" data-act="ob-next">${obStep < 2 ? '下一步' : '開始學習'}</button>
      </div>`;
    paint(`<div class="onboard">${steps}${body}${foot}</div>`, '', true);
  }
  function catPicker(act) {
    const sel = new Set(state.settings.cats);
    return `<div class="cat-pick">${CATS.map(c => `
      <button type="button" class="cat-opt${sel.has(c.key) ? ' on' : ''}" style="--c:${c.color}" data-act="${act}" data-cat="${c.key}" aria-pressed="${sel.has(c.key)}">
        <span class="t">${esc(c.zh)}</span>
        <span class="n">${catTotal[c.key] || 0} 字</span>
      </button>`).join('')}</div>`;
  }
  function toggleCat(key) {
    const set = new Set(state.settings.cats);
    if (set.has(key)) {
      if (set.size === 1) { toast('至少要選一個分類'); return false; }
      set.delete(key);
    } else set.add(key);
    state.settings.cats = CATS.map(c => c.key).filter(k => set.has(k));
    session = null;
    quiz = null;
    save();
    return true;
  }

  /* ---------- 首頁 ---------- */
  function renderHome() {
    const p = todayPlan();
    const learned = Object.keys(state.cards).filter(id => BY_ID.has(id));
    const mastered = learned.filter(id => state.cards[id].iv >= MASTERED_DAYS).length;
    const st = streak();
    const hr = new Date().getHours();
    const hello = hr < 5 ? '夜深了' : hr < 11 ? '早安' : hr < 18 ? '午安' : '晚安';
    const C = 2 * Math.PI * 40;
    const finished = p.due + p.newLeft === 0;
    const moreNew = availableNew(1).length > 0;

    let heroAction;
    if (!finished) heroAction = `<a class="btn" href="#/study">${p.done ? '繼續學習' : '開始今天的學習'}</a>`;
    else if (moreNew) heroAction = `<button class="btn" type="button" data-act="extra">再多學 10 個新字</button>`;
    else heroAction = `<a class="btn" href="#/quiz">來場隨堂測驗</a>`;

    const sel = new Set(state.settings.cats);
    const catRows = CATS.filter(c => catTotal[c.key] > 0).map(c => {
      const ids = DATA.filter(w => w.category === c.key).map(w => w.id);
      const l = ids.filter(id => state.cards[id]).length;
      const m = ids.filter(id => state.cards[id] && state.cards[id].iv >= MASTERED_DAYS).length;
      const tot = ids.length;
      return `
        <div class="cat-row${sel.has(c.key) ? '' : ' off'}" style="--c:${c.color}">
          <div class="name"><span class="dot"></span>${esc(c.zh)}</div>
          <div class="num">${l} / ${tot}</div>
          <div class="bar2" role="img" aria-label="${esc(c.zh)}：熟練 ${m}、已學 ${l}、共 ${tot}">
            <div class="m" style="width:${tot ? (m / tot) * 100 : 0}%"></div>
            <div class="l" style="width:${tot ? ((l - m) / tot) * 100 : 0}%"></div>
          </div>
        </div>`;
    }).join('');

    paint(`
      <div class="greet">
        <h1>${hello} 👋</h1>
        <p>${fmtDateZh(today())}${todayOverride ? '（模擬日期）' : ''}</p>
      </div>

      <div class="hero${finished ? ' done' : ''}">
        <div class="hero-top">
          <div class="ring">
            <svg viewBox="0 0 96 96"><circle class="track" cx="48" cy="48" r="40"/><circle class="bar" cx="48" cy="48" r="40" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p.pct)}"/></svg>
            <div class="ring-label"><b>${Math.round(p.pct * 100)}%</b><span>今日</span></div>
          </div>
          <div>
            <h2>${finished ? (p.done ? '今天的目標完成了！' : '今天沒有待學的字') : '今日任務'}</h2>
            <div class="hero-meta">
              <span>新字　<b>${p.ds.new}</b> / ${p.ds.new + p.newLeft}</span>
              <span>複習　<b>${p.ds.rev}</b> / ${p.ds.rev + p.due}</span>
            </div>
          </div>
        </div>
        ${heroAction}
      </div>

      <div class="section stats">
        <div class="stat"><div class="k">${ICON.book}已學</div><div class="v">${learned.length}<small>字</small></div></div>
        <div class="stat"><div class="k">${ICON.star}熟練</div><div class="v">${mastered}<small>字</small></div></div>
        <div class="stat streak"><div class="k">${ICON.fire}連續天數</div><div class="v">${st}<small>天</small></div></div>
        <div class="stat"><div class="k">${ICON.stack}字庫</div><div class="v">${DATA.length}<small>字</small></div></div>
      </div>

      <div class="section">
        <div class="section-title"><span>分類進度</span><a href="#/settings">調整分類</a></div>
        <div class="panel" style="padding:8px 4px 4px">
          <div class="cat-list">${catRows}</div>
          <div class="legend"><span><i></i>熟練</span><span><i class="l"></i>學習中</span></div>
        </div>
      </div>

      <p class="center" style="margin-top:22px;font-size:13px"><a href="#/about">資料來源與授權</a></p>
    `, 'home');
  }

  /* ---------- 學習 ---------- */
  let session = null;

  function interleave(reviews, news) {
    if (!news.length) return reviews;
    if (!reviews.length) return news;
    const step = Math.max(1, Math.ceil(reviews.length / news.length));
    const out = [];
    let ri = 0, ni = 0;
    while (ri < reviews.length || ni < news.length) {
      for (let k = 0; k < step && ri < reviews.length; k++) out.push(reviews[ri++]);
      if (ni < news.length) out.push(news[ni++]);
    }
    return out;
  }
  function buildSession(extraNew = 0) {
    const reviews = dueIds().map(id => ({ id, drill: false }));
    const news = availableNew(newLeftToday() + extraNew).map(id => ({ id, drill: false }));
    session = {
      date: today(),
      queue: interleave(reviews, news),
      pos: 0,
      flipped: false,
      stats: { new: 0, rev: 0, again: 0 },
      history: [],
    };
  }

  function renderStudy() {
    if (!session || session.date !== today()) buildSession();
    const s = session;
    while (s.pos < s.queue.length && !BY_ID.has(s.queue[s.pos].id)) s.pos++;
    if (s.pos >= s.queue.length) return renderStudyDone();
    const item = s.queue[s.pos];
    const w = BY_ID.get(item.id);
    const card = state.cards[w.id];
    const isNew = !card;
    const pct = (s.pos / s.queue.length) * 100;
    const longWord = w.en.length > 16;

    paint(`
      <div class="study">
        <div class="study-top">
          <a class="icon-btn" href="#/" aria-label="結束學習">${ICON.close}</a>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.queue.length}" aria-valuenow="${s.pos}"><div style="width:${pct}%"></div></div>
          <span class="count">${s.pos + 1} / ${s.queue.length}</span>
        </div>

        <div class="scene">
          <div class="card${s.flipped ? ' flipped' : ''}" id="card" data-act="flip" role="button" tabindex="0" aria-label="翻面">
            <div class="face front" aria-hidden="${s.flipped}">
              <div class="face-head">${catChip(w.category)}${levelDots(w.level)}</div>
              <div class="face-body">
                <div class="word${longWord ? ' long' : ''}">${esc(w.en)}</div>
                <div class="pron"><span class="pos">${esc(w.pos)}</span>${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ''}</div>
                ${speakBtn(w.en)}
              </div>
              <div class="hint">${item.drill ? '再複習一次 · ' : isNew ? '<span class="tag-new">新字</span> · ' : ''}點一下卡片看答案</div>
            </div>
            <div class="face back" aria-hidden="${!s.flipped}">
              <div class="face-head">${catChip(w.category)}${levelDots(w.level)}</div>
              <div class="face-body">
                <div class="back-word"><span class="en">${esc(w.en)}</span>${speakBtn(w.en, true)}</div>
                <div class="pron"><span class="pos">${esc(w.pos)}</span>${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ''}</div>
                <div class="zh">${esc(w.zh)}</div>
                ${exampleBlock(w)}
                ${w.note ? `<div class="note">${esc(w.note)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="actions" id="actions">${actionsHTML()}</div>
        <div class="study-foot">
          <button class="linkbtn" type="button" data-act="undo" ${s.history.length ? '' : 'disabled style="visibility:hidden"'}>${ICON.undo}復原</button>
          <span class="muted" style="font-size:12.5px">${isNew ? '新字' : item.drill ? '本輪重練' : `第 ${card.n + 1} 次複習`}</span>
        </div>
      </div>`, 'study', true);

    if (state.settings.autoSpeak && !s.flipped && !s.spoke) { s.spoke = true; TTS.speak(w.en); }
  }

  function actionsHTML() {
    const s = session;
    if (!s.flipped) return `<button class="btn primary block" type="button" data-act="flip" style="min-height:64px">顯示答案</button>`;
    const item = s.queue[s.pos];
    const prev = state.cards[item.id];
    return `<div class="grades">${GRADES.map(g => {
      let label;
      if (g.key === 'again') label = '稍後';
      else if (item.drill) label = '通過';
      else label = fmtIv(schedule(prev, g.key).iv);
      return `<button class="grade ${g.key}" type="button" data-act="grade" data-g="${g.key}">${g.zh}<small>${label}</small></button>`;
    }).join('')}</div>`;
  }

  function flip() {
    const s = session;
    if (!s) return;
    s.flipped = !s.flipped;
    const card = $('#card');
    if (!card) return;
    card.classList.toggle('flipped', s.flipped);
    card.querySelector('.front').setAttribute('aria-hidden', String(s.flipped));
    card.querySelector('.back').setAttribute('aria-hidden', String(!s.flipped));
    // 第一次翻面後就固定顯示評分按鈕
    if (s.flipped || !$('#actions .grades')) $('#actions').innerHTML = actionsHTML();
  }

  function answer(gradeKey) {
    const s = session;
    if (!s || !s.flipped) return;
    const item = s.queue[s.pos];
    const t = today();
    const snap = {
      pos: s.pos,
      queue: s.queue.slice(),
      stats: { ...s.stats },
      id: item.id,
      card: state.cards[item.id] ? { ...state.cards[item.id] } : undefined,
      day: state.days[t] ? { ...state.days[t] } : undefined,
      day_key: t,
    };
    if (!item.drill) {
      const wasNew = !state.cards[item.id];
      state.cards[item.id] = schedule(state.cards[item.id], gradeKey, t);
      bumpDay(wasNew ? 'new' : 'rev');
      s.stats[wasNew ? 'new' : 'rev']++;
    }
    if (gradeKey === 'again') {
      s.stats.again++;
      const at = Math.min(s.pos + 1 + DRILL_GAP, s.queue.length);
      s.queue.splice(at, 0, { id: item.id, drill: true });
    }
    s.history.push(snap);
    if (s.history.length > 50) s.history.shift();
    s.pos++;
    s.flipped = false;
    s.spoke = false;
    save();
    renderStudy();
  }

  function undo() {
    const s = session;
    const h = s && s.history.pop();
    if (!h) return;
    s.pos = h.pos;
    s.queue = h.queue;
    s.stats = h.stats;
    if (h.card) state.cards[h.id] = h.card; else delete state.cards[h.id];
    if (h.day) state.days[h.day_key] = h.day; else delete state.days[h.day_key];
    s.flipped = true;
    save();
    renderStudy();
  }

  function renderStudyDone() {
    const s = session;
    const moreNew = availableNew(1).length > 0;
    const empty = s.queue.length === 0;
    paint(`
      <div class="done-view">
        <div class="big">${empty ? '☕️' : '🎉'}</div>
        <h2>${empty ? '目前沒有要學的字' : '這一輪完成了！'}</h2>
        <p>${empty ? '今天的新字與複習都完成了，明天再來吧。' : `連續學習 ${streak()} 天，繼續保持！`}</p>
        ${empty ? '' : `
        <div class="summary">
          <div><b>${s.stats.new}</b><span>新字</span></div>
          <div><b>${s.stats.rev}</b><span>複習</span></div>
          <div><b>${s.stats.again}</b><span>忘記</span></div>
        </div>`}
        <div class="stack" style="margin-top:${empty ? 26 : 0}px">
          ${moreNew ? '<button class="btn primary block" type="button" data-act="extra">再多學 10 個新字</button>' : ''}
          <a class="btn block" href="#/quiz">隨堂測驗</a>
          <a class="btn ghost block" href="#/">回首頁</a>
        </div>
      </div>`, 'study');
  }

  /* ---------- 測驗 ---------- */
  let quiz = null;
  const QUIZ_LEN = 10;

  function buildQuiz() {
    const learned = Object.keys(state.cards).filter(id => BY_ID.has(id));
    const sel = new Set(state.settings.cats);
    let pool = learned;
    let fromLearned = true;
    if (pool.length < 4) {
      fromLearned = false;
      pool = DATA.filter(w => sel.has(w.category)).map(w => w.id);
      if (pool.length < 4) pool = DATA.map(w => w.id);
    }
    if (DATA.length < 4) { quiz = null; return; }
    const qs = [];
    for (const id of shuffle(pool)) {
      if (qs.length >= QUIZ_LEN) break;
      const q = makeQuestion(id);
      if (q) qs.push(q);
    }
    if (qs.length < 1) { quiz = null; return; }
    quiz = { qs, i: 0, score: 0, picked: null, wrong: [], fromLearned };
  }
  function makeQuestion(id) {
    const w = BY_ID.get(id);
    const dir = Math.random() < 0.5 ? 'en2zh' : 'zh2en';
    const key = dir === 'en2zh' ? 'zh' : 'en';
    const seen = new Set([w[key].toLowerCase()]);
    const picks = [];
    const tryAdd = list => {
      for (const x of list) {
        if (picks.length >= 3) break;
        const k = x[key].toLowerCase();
        if (x.id === id || seen.has(k)) continue;
        seen.add(k);
        picks.push(x.id);
      }
    };
    tryAdd(shuffle(DATA.filter(x => x.category === w.category)));
    tryAdd(shuffle(DATA));
    if (picks.length < 3) return null;
    return { id, dir, options: shuffle([id, ...picks]) };
  }

  function renderQuiz() {
    if (!quiz) buildQuiz();
    if (!quiz) {
      paint(`<div class="empty"><div class="big">📭</div><p>字庫不足 4 個字，無法出題。</p></div>`, 'quiz');
      return;
    }
    if (quiz.i >= quiz.qs.length) return renderQuizResult();
    const q = quiz.qs[quiz.i];
    const w = BY_ID.get(q.id);
    const answered = quiz.picked !== null;
    const prompt = q.dir === 'en2zh'
      ? `<div class="word">${esc(w.en)}</div>${speakBtn(w.en, true)}`
      : `<div class="zhp">${esc(w.zh)}</div>`;
    const opts = q.options.map((oid, i) => {
      const o = BY_ID.get(oid);
      if (!o) return '';
      let cls = '';
      if (answered) {
        if (oid === q.id) cls = ' correct';
        else if (oid === quiz.picked) cls = ' wrong';
      }
      const text = q.dir === 'en2zh' ? esc(o.zh) : `<span class="en">${esc(o.en)}</span>`;
      return `<button class="option${cls}" type="button" data-act="pick" data-id="${esc(oid)}" ${answered ? 'disabled' : ''}><span class="key">${i + 1}</span><span>${text}</span></button>`;
    }).join('');
    const last = quiz.i === quiz.qs.length - 1;

    paint(`
      <div class="study-top">
        <a class="icon-btn" href="#/" aria-label="離開測驗">${ICON.close}</a>
        <div class="progress"><div style="width:${(quiz.i / quiz.qs.length) * 100}%"></div></div>
        <span class="count">${quiz.i + 1} / ${quiz.qs.length}</span>
      </div>
      ${quiz.fromLearned ? '' : '<p class="muted center" style="font-size:13px;margin-bottom:8px">已學的字還不夠，先從你選的分類出題</p>'}
      <div class="panel quiz-q">
        <div class="dir">${q.dir === 'en2zh' ? '選出正確的中文意思' : '選出正確的英文'}</div>
        <div class="prompt">${prompt}</div>
      </div>
      <div class="options${answered ? ' answered' : ''}">${opts}</div>
      ${answered ? `
        <div class="feedback">
          <div><b>${quiz.picked === q.id ? '✅ 答對了' : '❌ 正確答案'}</b>：<span class="en">${esc(w.en)}</span> ${esc(w.pos)} ${esc(w.zh)}</div>
          ${w.example_en ? `<div class="ex-en" style="margin-top:6px">${highlight(w.example_en, w.en.replace(/[.。!?]+$/, ''))}</div><div class="ex-zh">${esc(w.example_zh)}</div>` : ''}
        </div>
        <button class="btn primary block" type="button" data-act="quiz-next" style="margin-top:14px">${last ? '看結果' : '下一題'}</button>` : ''}
    `, 'quiz', true);
  }

  function pick(id) {
    if (!quiz || quiz.picked !== null) return;
    const q = quiz.qs[quiz.i];
    quiz.picked = id;
    if (id === q.id) quiz.score++;
    else quiz.wrong.push(q.id);
    if (q.dir === 'zh2en' && TTS.ok && state.settings.autoSpeak) TTS.speak(BY_ID.get(q.id).en);
    renderQuiz();
  }
  function quizNext() {
    if (!quiz) return;
    quiz.i++;
    quiz.picked = null;
    renderQuiz();
  }

  function renderQuizResult() {
    const n = quiz.qs.length;
    const pct = Math.round((quiz.score / n) * 100);
    const face = pct === 100 ? '🏆' : pct >= 70 ? '👏' : pct >= 40 ? '💪' : '📚';
    const wrongList = quiz.wrong.map(id => BY_ID.get(id)).map(w => `
      <div class="witem"><button type="button" data-act="speak" data-text="${esc(w.en)}">
        <span class="w-en">${esc(w.en)}<span class="pos">${esc(w.pos)}</span></span>
        <span class="status">${TTS.ok ? `<span class="speak sm" aria-hidden="true">${ICON.speak}</span>` : ''}</span>
        <span class="w-zh">${esc(w.zh)}</span>
      </button></div>`).join('');
    paint(`
      <div class="done-view">
        <div class="big">${face}</div>
        <h2>答對 ${quiz.score} / ${n} 題</h2>
        <p>${pct === 100 ? '全對！表現太好了。' : '答錯的字下面幫你整理好了。'}</p>
      </div>
      ${wrongList ? `<div class="section-title"><span>需要加強</span></div><div class="word-list">${wrongList}</div>` : ''}
      <div class="stack" style="margin-top:20px">
        <button class="btn primary block" type="button" data-act="quiz-again">再測一次</button>
        <a class="btn ghost block" href="#/">回首頁</a>
      </div>`, 'quiz');
  }

  /* ---------- 字庫／搜尋 ---------- */
  const browse = { q: '', cat: 'all', limit: 60, open: null };

  function renderBrowse() {
    const filters = [`<button class="filter${browse.cat === 'all' ? ' on' : ''}" type="button" data-act="bcat" data-cat="all">全部</button>`]
      .concat(CATS.filter(c => catTotal[c.key] > 0).map(c =>
        `<button class="filter${browse.cat === c.key ? ' on' : ''}" type="button" data-act="bcat" data-cat="${c.key}" style="--c:${c.color}"><span class="dot"></span>${esc(c.zh)}</button>`)).join('');
    paint(`
      <div class="search">
        <div class="search-box">
          ${ICON.search}
          <input id="q" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="搜尋英文或中文…" value="${esc(browse.q)}" aria-label="搜尋單字">
        </div>
        <div class="filters">${filters}</div>
      </div>
      <div id="results"></div>`, 'browse');
    renderResults();
    $('#q').addEventListener('input', e => {
      browse.q = e.target.value;
      browse.limit = 60;
      renderResults();
    });
  }

  function searchWords() {
    const q = browse.q.trim().toLowerCase();
    let list = DATA;
    if (browse.cat !== 'all') list = list.filter(w => w.category === browse.cat);
    if (q) {
      const scored = [];
      for (const w of list) {
        const en = w.en.toLowerCase();
        let score = -1;
        if (en === q) score = 0;
        else if (en.startsWith(q)) score = 1;
        else if (en.includes(q)) score = 2;
        else if (w.zh.includes(q)) score = 3;
        else if ((w.example_en || '').toLowerCase().includes(q) || (w.example_zh || '').includes(q)) score = 4;
        if (score >= 0) scored.push([score, w]);
      }
      scored.sort((a, b) => a[0] - b[0] || a[1].en.length - b[1].en.length);
      list = scored.map(x => x[1]);
    }
    return list;
  }

  function renderResults() {
    const box = $('#results');
    if (!box) return;
    const list = searchWords();
    const term = browse.q.trim();
    if (!list.length) {
      box.innerHTML = `<div class="empty"><div class="big">🔍</div><p>找不到「${esc(term)}」</p></div>`;
      return;
    }
    const shown = list.slice(0, browse.limit);
    box.innerHTML = `
      <div class="result-meta">共 ${list.length} 筆${list.length > shown.length ? `，顯示前 ${shown.length} 筆` : ''}</div>
      <div class="word-list">${shown.map(w => {
        const st = statusOf(w.id);
        const c = state.cards[w.id];
        return `
        <div class="witem${browse.open === w.id ? ' open' : ''}" data-id="${esc(w.id)}">
          <button type="button" data-act="wopen" data-id="${esc(w.id)}" aria-expanded="${browse.open === w.id}">
            <span class="w-en">${highlight(w.en, term)}<span class="pos">${esc(w.pos)}</span></span>
            <span class="status"><span class="badge ${st}">${STATUS_ZH[st]}</span></span>
            <span class="w-zh">${highlight(w.zh, term)}</span>
          </button>
          <div class="detail">
            <div class="meta">${catChip(w.category)}${levelDots(w.level)}${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ''}${speakBtn(w.en, true)}</div>
            ${exampleBlock(w)}
            ${w.note ? `<div class="note" style="margin-top:8px">${esc(w.note)}</div>` : ''}
            ${c ? `<p class="muted" style="font-size:12.5px;margin-top:8px">下次複習：${esc(c.due)}（間隔 ${fmtIv(c.iv)}）</p>` : ''}
          </div>
        </div>`;
      }).join('')}</div>
      ${list.length > shown.length ? '<button class="btn ghost block" type="button" data-act="more" style="margin-top:12px">顯示更多</button>' : ''}`;
  }

  /* ---------- 設定 ---------- */
  function renderSettings() {
    const s = state.settings;
    const seg = (act, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) =>
      `<button type="button" class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    paint(`
      <div class="section" style="margin-top:8px">
        <div class="section-title"><span>學習目標</span></div>
        <div class="panel list">
          <div class="setting">
            <div><div class="label">每日新字</div><div class="desc">複習量會自動依記憶狀況安排</div></div>
            <div class="stepper">
              <button type="button" data-act="goal" data-d="-5" aria-label="減少">−</button>
              <output id="goalOut">${s.dailyNew}</output>
              <button type="button" data-act="goal" data-d="5" aria-label="增加">＋</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><span>學習分類</span></div>
        ${catPicker('set-cat')}
        <p class="muted" style="font-size:13px;margin:10px 4px 0">新字只會從勾選的分類出；已學過的字不論分類都會排入複習。</p>
      </div>

      <div class="section">
        <div class="section-title"><span>外觀與發音</span></div>
        <div class="panel list">
          <div class="setting">
            <div class="label">主題</div>
            ${seg('theme', s.theme, [['auto', '自動'], ['light', '淺色'], ['dark', '深色']])}
          </div>
          <div class="setting">
            <div><div class="label">自動發音</div><div class="desc">${TTS.ok ? '出現新卡片時自動朗讀英文' : '此瀏覽器不支援語音朗讀'}</div></div>
            <label class="switch"><input type="checkbox" data-act="autospeak" ${s.autoSpeak ? 'checked' : ''} ${TTS.ok ? '' : 'disabled'} aria-label="自動發音"><span></span></label>
          </div>
          <div class="setting">
            <div><div class="label">語速</div><div class="desc" id="rateOut">${s.rate.toFixed(1)}×</div></div>
            <div class="row">
              <input type="range" id="rate" min="0.5" max="1.3" step="0.1" value="${s.rate}" ${TTS.ok ? '' : 'disabled'} aria-label="語速">
              ${speakBtn('Thank you for your prompt reply.', true)}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><span>學習紀錄</span></div>
        <div class="panel">
          <p class="muted" style="font-size:14px">進度只存在這台裝置的瀏覽器中。換手機或清除瀏覽資料前，請先匯出備份。</p>
          <div class="row" style="margin-top:14px">
            <button class="btn grow" type="button" data-act="export">匯出進度</button>
            <button class="btn grow" type="button" data-act="import">匯入進度</button>
          </div>
          <button class="btn danger block" type="button" data-act="reset" style="margin-top:10px">重設所有進度</button>
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><span>關於</span></div>
        <div class="panel list">
          <a class="setting" href="#/about" style="color:inherit"><span class="label">資料來源與授權</span><span class="muted">›</span></a>
          <div class="setting"><span class="label">版本</span><span class="muted en">${APP_VERSION} · ${DATA.length} 字</span></div>
        </div>
      </div>`, 'settings');

    const rate = $('#rate');
    rate.addEventListener('input', () => { $('#rateOut').textContent = `${Number(rate.value).toFixed(1)}×`; });
    rate.addEventListener('change', () => { state.settings.rate = Number(rate.value); save(); });
    $('#importFile').addEventListener('change', onImportFile);
  }

  function exportProgress() {
    const payload = {
      app: 'biz-english-4000',
      version: state.version,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      cards: state.cards,
      days: state.days,
    };
    const name = `biz-english-4000-progress-${today()}.json`;
    const json = JSON.stringify(payload, null, 2);
    // iOS 主畫面與 Safari 常常忽略 <a download>，能分享檔案時改走系統分享
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: '商用英文 4000 進度' })
          .then(() => toast('已匯出進度檔'))
          .catch(err => { if (!err || err.name !== 'AbortError') downloadProgress(json, name); });
        return;
      }
    } catch (e) { /* 改走下載 */ }
    downloadProgress(json, name);
  }
  function downloadProgress(json, name) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('已匯出進度檔');
  }

  async function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('檔案太大（上限 2 MB）'); return; }
    let obj;
    try { obj = JSON.parse(await file.text()); }
    catch (err) { toast('檔案不是有效的 JSON'); return; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || typeof obj.cards !== 'object' || obj.cards === null || Array.isArray(obj.cards)) {
      toast('這不是本 App 匯出的進度檔');
      return;
    }
    if (obj.app != null && obj.app !== 'biz-english-4000') {
      toast('這不是本 App 匯出的進度檔');
      return;
    }
    const rawN = Object.keys(obj.cards).length;
    const next = normalizeState(obj);
    const n = Object.keys(next.cards).length;
    if (rawN > 0 && n === 0) { toast('進度檔裡沒有可用的學習紀錄'); return; }
    const dropped = rawN - n;
    const body = dropped > 0
      ? `檔案內有 ${rawN} 筆紀錄，其中 ${n} 筆格式正確，會取代目前裝置上的所有進度。其餘 ${dropped} 筆格式不符，會略過。`
      : `檔案內有 ${n} 個已學單字的紀錄，會取代目前裝置上的所有進度。`;
    const ok = await confirmBox({ title: '匯入進度？', body, ok: '匯入並取代' });
    if (!ok) return;
    next.settings.onboarded = true;
    state = next;
    save();
    session = null;
    quiz = null;
    applyTheme();
    toast(`已匯入 ${n} 筆紀錄`);
    render();
  }

  async function resetProgress() {
    const ok = await confirmBox({ title: '重設所有進度？', body: '所有學習紀錄與設定都會刪除，且無法復原。建議先匯出備份。', ok: '全部重設', danger: true });
    if (!ok) return;
    state = freshState();
    save();
    session = null;
    quiz = null;
    obStep = 0;
    applyTheme();
    location.hash = '#/';
    render();
    toast('已重設');
  }

  /* ---------- 資料來源與授權 ---------- */
  function renderAbout() {
    paint(`
      <div class="prose">
        <h1>資料來源與授權</h1>
        <div class="panel stack">
          <h2>單字資料</h2>
          <p class="statement">由 AI 依一般商用英文與通訊產業常用詞彙自行整理，非翻抄任何版權字表；內容可能有誤，建議查證。</p>
          <ul>
            <li>字庫共 ${DATA.length} 筆，分為 ${CATS.length} 個分類，以通訊電信產業用語為主。</li>
            <li>中文翻譯與例句採台灣用語，例句以商務情境為主。</li>
            <li>音標僅供參考，以美式發音為準。</li>
          </ul>
        </div>
        <div class="panel stack">
          <h2>發音</h2>
          <p>朗讀功能使用瀏覽器內建的 Web Speech API，語音由你的裝置或作業系統提供，音質依裝置而異。</p>
        </div>
        <div class="panel stack">
          <h2>隱私</h2>
          <p>學習進度只儲存在本機瀏覽器（localStorage），不會上傳到任何伺服器，也不使用追蹤或分析工具。</p>
        </div>
        <div class="panel stack">
          <h2>複習演算法</h2>
          <p>採用 SM-2 間隔重複演算法（公開的通用方法），並依「困難／簡單」微調間隔。間隔達 ${MASTERED_DAYS} 天以上的字視為「熟練」。</p>
        </div>
        <a class="btn ghost block" href="#/" style="margin-top:16px">回首頁</a>
      </div>`, 'settings');
  }

  /* ---------- 錯誤 ---------- */
  let loadError = null;
  function renderError() {
    paint(`
      <div class="empty">
        <div class="big">⚠️</div>
        <p>單字資料載入失敗</p>
        <p class="muted" style="font-size:13px;margin-top:6px">${esc(loadError)}</p>
        <button class="btn primary" type="button" data-act="retry" style="margin-top:18px">重新載入</button>
      </div>`, 'home');
  }

  /* ---------- 事件 ---------- */
  const actions = {
    speak: el => TTS.speak(el.dataset.text),
    flip: () => flip(),
    grade: el => answer(el.dataset.g),
    undo: () => undo(),
    extra: () => { buildSession(10); location.hash === '#/study' ? renderStudy() : (location.hash = '#/study'); },

    'ob-goal': el => { state.settings.dailyNew = Number(el.dataset.n); save(); renderOnboarding(); },
    'ob-cat': el => { if (toggleCat(el.dataset.cat)) renderOnboarding(); },
    'ob-back': () => { obStep = Math.max(0, obStep - 1); renderOnboarding(); },
    'ob-next': () => {
      if (obStep < 2) { obStep++; renderOnboarding(); return; }
      state.settings.onboarded = true;
      save();
      session = null;
      location.hash = '#/';
      render();
      toast('準備好了，開始第一輪吧！');
    },

    pick: el => pick(el.dataset.id),
    'quiz-next': () => quizNext(),
    'quiz-again': () => { buildQuiz(); renderQuiz(); },

    bcat: el => { browse.cat = el.dataset.cat; browse.limit = 60; renderBrowse(); },
    wopen: el => {
      const id = el.dataset.id;
      browse.open = browse.open === id ? null : id;
      document.querySelectorAll('.witem').forEach(n => {
        const on = n.dataset.id === browse.open;
        n.classList.toggle('open', on);
        n.firstElementChild.setAttribute('aria-expanded', String(on));
      });
    },
    more: () => { browse.limit += 100; renderResults(); },

    goal: el => {
      state.settings.dailyNew = clamp(state.settings.dailyNew + Number(el.dataset.d), 5, 100);
      save();
      session = null;
      $('#goalOut').textContent = state.settings.dailyNew;
    },
    'set-cat': el => { if (toggleCat(el.dataset.cat)) renderSettings(); },
    theme: el => { state.settings.theme = el.dataset.v; save(); applyTheme(); renderSettings(); },
    autospeak: el => { state.settings.autoSpeak = el.checked; save(); },
    export: () => exportProgress(),
    import: () => $('#importFile').click(),
    reset: () => resetProgress(),
    retry: () => location.reload(),
  };

  view().addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.type !== 'checkbox') e.preventDefault();
    fn(el, e);
  });

  $('#themeBtn').addEventListener('click', () => {
    state.settings.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    save();
    applyTheme();
    if (route() === 'settings' && state.settings.onboarded) renderSettings();
  });

  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || $('#modal').firstChild) return;
    const r = route();
    if (r === 'study' && session && session.pos < session.queue.length && state.settings.onboarded) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!session.flipped) flip();
      } else if (session.flipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        answer(GRADES[Number(e.key) - 1].key);
      } else if (e.key === 'u' || e.key === 'z') undo();
      else if (e.key === 's' || e.key === 'p') {
        const w = BY_ID.get(session.queue[session.pos].id);
        if (w) TTS.speak(w.en);
      }
    } else if (r === 'quiz' && quiz && quiz.i < quiz.qs.length) {
      if (quiz.picked === null && ['1', '2', '3', '4'].includes(e.key)) {
        const id = quiz.qs[quiz.i].options[Number(e.key) - 1];
        if (id) pick(id);
      } else if (quiz.picked !== null && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        quizNext();
      }
    }
  });

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });

  /* ---------- 測試用介面 ---------- */
  window.__app = {
    version: APP_VERSION,
    /** 模擬日期（YYYY-MM-DD）；傳 null 恢復真實日期 */
    setToday(dateStr) {
      if (dateStr == null || dateStr === '') todayOverride = null;
      else if (isValidYMD(dateStr)) todayOverride = dateStr;
      else throw new Error(`setToday: 日期格式須為 YYYY-MM-DD，收到 ${dateStr}`);
      session = null;
      render();
      return today();
    },
    today,
    get state() { return state; },
    get session() { return session; },
    schedule,
    dueIds,
  };

  /* ---------- 啟動 ---------- */
  applyTheme();
  fetch('data.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(arr => {
      if (!Array.isArray(arr)) throw new Error('data.json 格式錯誤');
      indexData(arr);
      if (!DATA.length) throw new Error('data.json 沒有任何單字');
      render();
    })
    .catch(err => { loadError = err.message || String(err); render(); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
  }
})();
