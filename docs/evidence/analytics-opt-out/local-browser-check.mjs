import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE='http://127.0.0.1:8765/';
const PAGES=['index.html','delivery.html','forecast-risk.html','forecastability.html','privacy.html'];
// Local stand-in for Vercel's script: drains the queue, applies beforeSend, posts one page view.
const STANDIN=`(function(){var bs=null;function h(a){if(a[0]==='beforeSend')bs=a[1];}
(window.vaq||[]).forEach(h);window.va=function(){h(arguments)};
var ev={type:'pageview',url:location.href};if(bs)ev=bs(ev);
if(ev)fetch('/_vercel/insights/view',{method:'POST',body:JSON.stringify(ev)});})();`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
async function ctx(init){const c=await browser.newContext();if(init)await c.addInitScript(init);
 c.log={script:0,view:0};
 await c.route('**/_vercel/insights/script.js',r=>{c.log.script++;r.fulfill({status:200,contentType:'text/javascript',body:STANDIN})});
 await c.route('**/_vercel/insights/view',r=>{c.log.view++;r.fulfill({status:200,body:''})});
 return c;}
async function visit(c,p,name){const pg=await c.newPage();const s0=c.log.script,v0=c.log.view;
 await pg.goto(BASE+p);await pg.waitForLoadState('networkidle');
 const r={script:c.log.script-s0,view:c.log.view-v0};await pg.close();return r;}
async function state(pg){return pg.evaluate(()=>({button:document.getElementById('analytics-toggle').textContent,hidden:document.getElementById('analytics-toggle').hidden,disabled:document.getElementById('analytics-toggle').disabled,status:document.getElementById('analytics-status').textContent,stored:(()=>{try{return localStorage.getItem('va-disable')}catch(e){return 'unreadable'}})(),radius:getComputedStyle(document.getElementById('analytics-toggle')).borderTopLeftRadius}))}
const out={};
let c=await ctx();
out.a={}; for(const p of PAGES) out.a[p]=await visit(c,p);
let pg=await c.newPage(); await pg.goto(BASE+'privacy.html'); out.a_state=await state(pg);
await pg.click('#analytics-toggle'); out.b_after_click=await state(pg);
await pg.screenshot({path:'/tmp/claude-0/pw/off.png',clip:await pg.locator('#analytics-toggle').evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return {x:0,y:r.y-10,width:1200,height:r.height+20}})});
await pg.reload(); await pg.waitForLoadState('networkidle'); out.d_off_after_reload=await state(pg); await pg.close();
out.b={}; for(const p of PAGES) out.b[p]=await visit(c,p);
pg=await c.newPage(); await pg.goto(BASE+'privacy.html'); await pg.click('#analytics-toggle'); out.c_after_click=await state(pg);
await pg.reload(); await pg.waitForLoadState('networkidle'); out.d_on_after_reload=await state(pg); await pg.close();
out.c={}; for(const p of PAGES) out.c[p]=await visit(c,p);
await c.close();
c=await ctx(`Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true})`);
out.gpc={}; for(const p of PAGES) out.gpc[p]=await visit(c,p);
pg=await c.newPage(); await pg.goto(BASE+'privacy.html'); out.gpc_state=await state(pg); await c.close();
c=await ctx(`Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})`);
out.nostore={}; for(const p of PAGES) out.nostore[p]=await visit(c,p);
pg=await c.newPage(); await pg.goto(BASE+'privacy.html'); out.nostore_state=await state(pg);
await pg.screenshot({path:'/tmp/claude-0/pw/nostore.png',fullPage:false}); await c.close();
c=await ctx(`Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}});Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true})`);
out.nostore_gpc={}; for(const p of PAGES) out.nostore_gpc[p]=await visit(c,p); await c.close();
console.log(JSON.stringify(out,null,1)); await browser.close();
