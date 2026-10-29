/* Google 登入＋雲端同步（選用）。設定未填、離線或未登入時完全不影響本機使用。 */
import { firebaseConfig } from './firebase-config.js';
import { mergeStates, toCloud, fromCloud } from './merge.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LAST_KEY = 'biz4000.lastSync';
const REDIRECT_KEY = 'biz4000.authRedirect';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
const errMsg = code => {
  if (/unauthorized-domain/.test(code)) return '這個網址尚未加入登入白名單，請稍後再試或聯絡開發者。';
  if (/network-request-failed/.test(code)) return '網路不穩，登入沒有完成，請再試一次。';
  if (/too-many-requests/.test(code)) return '嘗試次數過多，請稍後再試。';
  if (/operation-not-allowed/.test(code)) return '尚未啟用 Google 登入，請聯絡開發者。';
  return '登入沒有完成，請再試一次（' + code + '）。';
};
const sync = {
  status: 'unconfigured', // unconfigured | loading | error | signedOut | signedIn
  email: '',
  lastSync: Number(lsGet(LAST_KEY)) || 0,
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
  auth.languageCode = 'zh-TW';
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let user = null;
  let timer = null;

  // 一定要在使用者點擊的同一個事件裡呼叫（中間不能有 await），否則 iOS Safari 會擋彈出視窗。
  // 先試 popup；只有被擋或環境不支援才改用 redirect。
  // 注意：authDomain（*.firebaseapp.com）與網站（github.io）不同源，Safari 16.1+ / 第三方儲存空間被封鎖的瀏覽器
  // 在 redirect 回來後常拿不到結果，所以 redirect 只當備援，並用旗標偵測「繞一圈回來卻沒登入」。
  sync.signIn = async () => {
    if (sync.signingIn) return;
    sync.signingIn = true;
    sync.message = '';
    notify();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = e && e.code || '';
      if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(code)) {
        try {
          lsSet(REDIRECT_KEY, String(Date.now()));
          window.__app && window.__app.beforeAuthRedirect && window.__app.beforeAuthRedirect();
          await signInWithRedirect(auth, provider);
          return;
        } catch (e2) {
          lsDel(REDIRECT_KEY);
          sync.message = errMsg(e2 && e2.code || '');
        }
      } else if (!/popup-closed|cancelled-popup/.test(code)) {
        sync.message = errMsg(code);
      }
    } finally {
      sync.signingIn = false;
      notify();
    }
  };
  sync.signOut = async () => { await signOut(auth); };

  sync.syncNow = async () => {
    if (!user || !navigator.onLine || !window.__app) return;
    if (sync.busy) { sync.again = true; return; }
    sync.busy = true;
    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      const remote = snap.exists() ? fromCloud(snap.data()) : null;
      const local = window.__app.exportSyncState();
      // 還沒完成引導的裝置（例如換手機第一次登入）以雲端的暱稱與設定為準
      const merged = mergeStates(local, remote, { preferRemoteSettings: !(local.settings && local.settings.onboarded) });
      window.__app.applySyncState(merged);
      await setDoc(ref, toCloud(window.__app.exportSyncState()));
      sync.lastSync = Date.now();
      lsSet(LAST_KEY, String(sync.lastSync));
      sync.message = '';
    } catch (e) {
      sync.message = '同步失敗，稍後會再試一次。';
    } finally {
      sync.busy = false;
      notify();
      if (sync.again) { sync.again = false; sync.syncNow(); }
    }
  };
  sync.schedule = () => {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync.syncNow(), 5000);
  };

  const hadRedirect = !!lsGet(REDIRECT_KEY);
  const redirectDone = getRedirectResult(auth).then(r => {
    lsDel(REDIRECT_KEY);
    return r;
  }).catch(e => {
    lsDel(REDIRECT_KEY);
    sync.message = errMsg(e && e.code || '');
    return null;
  });
  if (hadRedirect) {
    redirectDone.then(r => {
      if (!r && !auth.currentUser) {
        sync.message = '這個瀏覽器擋住了登入跳轉（常見於 iPhone Safari 的隱私設定）。請改用 Chrome／Safari 一般模式，或稍後在設定再試。';
        notify();
      }
    });
  }
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
