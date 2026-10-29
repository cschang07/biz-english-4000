/* Google 登入＋雲端同步（選用）。設定未填、離線或未登入時完全不影響本機使用。 */
import { firebaseConfig } from './firebase-config.js';
import { mergeStates, toCloud, fromCloud } from './merge.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LAST_KEY = 'biz4000.lastSync';
const sync = {
  status: 'unconfigured', // unconfigured | loading | error | signedOut | signedIn
  email: '',
  lastSync: Number(localStorage.getItem(LAST_KEY)) || 0,
  busy: false,
  message: '',
  signIn: async () => {},
  signOut: async () => {},
  syncNow: async () => {},
  schedule() {},
};
window.__sync = sync;
const notify = () => { try { window.__app && window.__app.onSyncChange(); } catch (e) {} };

const configured = firebaseConfig && Object.values(firebaseConfig).every(v => typeof v === 'string' && v && !v.includes('REPLACE_ME'));

async function start() {
  if (!configured) { notify(); return; }
  sync.status = 'loading';
  notify();
  let appMod, authMod, fsMod;
  try {
    [appMod, authMod, fsMod] = await Promise.all([
      import(FB + 'firebase-app.js'),
      import(FB + 'firebase-auth.js'),
      import(FB + 'firebase-firestore.js'),
    ]);
  } catch (e) {
    sync.status = 'error';
    sync.message = '目前無法連線雲端（可能離線），進度仍會存在本機。';
    notify();
    return;
  }
  const { initializeApp } = appMod;
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } = authMod;
  const { getFirestore, doc, getDoc, setDoc } = fsMod;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  let user = null;
  let timer = null;

  sync.signIn = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) {
      const code = e && e.code || '';
      if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(code)) {
        await signInWithRedirect(auth, provider);
      } else if (!/popup-closed|cancelled-popup/.test(code)) {
        sync.message = '登入失敗：' + code;
        notify();
      }
    }
  };
  sync.signOut = async () => { await signOut(auth); };

  sync.syncNow = async () => {
    if (!user || sync.busy || !navigator.onLine || !window.__app) return;
    sync.busy = true;
    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      const remote = snap.exists() ? fromCloud(snap.data()) : null;
      const merged = mergeStates(window.__app.exportSyncState(), remote);
      window.__app.applySyncState(merged);
      await setDoc(ref, toCloud(window.__app.exportSyncState()));
      sync.lastSync = Date.now();
      localStorage.setItem(LAST_KEY, String(sync.lastSync));
      sync.message = '';
    } catch (e) {
      sync.message = '同步失敗，稍後會再試一次。';
    } finally {
      sync.busy = false;
      notify();
    }
  };
  sync.schedule = () => {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync.syncNow(), 5000);
  };

  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, u => {
    user = u;
    sync.status = u ? 'signedIn' : 'signedOut';
    sync.email = u ? (u.email || '') : '';
    notify();
    if (u) sync.syncNow();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.syncNow(); });
  window.addEventListener('online', () => sync.syncNow());
}

start().catch(() => { sync.status = 'error'; sync.message = '雲端同步初始化失敗，進度仍會存在本機。'; notify(); });
