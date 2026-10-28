import { chromium } from 'playwright';
const errs=[]; const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push(e.message));
const U='http://localhost:8765/'; const s=n=>p.screenshot({path:`shots/${n}.png`});
await p.goto(U); await p.waitForTimeout(800); await s('01-onboarding');
for(let i=0;i<3;i++){const n=p.locator('[data-act="ob-next"]'); if(await n.count()){await n.click(); await p.waitForTimeout(300);}}
await s('02-home');
await p.goto(U+'#/study'); await p.waitForTimeout(500); await s('03-card-front');
await p.locator('[data-act="flip"]').first().click(); await p.waitForTimeout(400); await s('04-card-back');
let graded=0; for(let i=0;i<25;i++){ const f=p.locator('[data-act="flip"]'); if(await f.count()) await f.first().click().catch(()=>{}); const g=p.locator('[data-act="grade"]'); if(!await g.count()) break; await g.nth(i%4).click(); graded++; await p.waitForTimeout(80);} 
console.log('graded',graded); await s('05-session-done');
const due0=await p.evaluate(()=>__app.dueIds().length);
await p.evaluate(()=>__app.setToday('2099-01-02')); const due1=await p.evaluate(()=>__app.dueIds().length);
console.log('due today',due0,'due future',due1);
await p.goto(U+'#/'); await p.waitForTimeout(300); await s('06-dashboard');
await p.goto(U+'#/search'); await p.waitForTimeout(300); const inp=p.locator('input').first(); if(await inp.count()){await inp.fill('roaming'); await p.waitForTimeout(400);} await s('07-search');
await p.goto(U+'#/quiz'); await p.waitForTimeout(400); await s('08-quiz');
await p.goto(U+'#/settings'); await p.waitForTimeout(300); await s('09-settings');
await p.goto(U+'#/about'); await p.waitForTimeout(300); await s('10-about');
await p.emulateMedia({colorScheme:'dark'}); await p.goto(U+'#/'); await p.waitForTimeout(300); await s('11-dark');
console.log('localStorage keys',await p.evaluate(()=>Object.keys(localStorage)));
console.log('ERRORS',errs); await b.close();
