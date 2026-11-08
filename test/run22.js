// Permanent streak rewards, legacy migration, celebrations and phone layouts.
const {chromium}=require('playwright');
const BASE=process.env.BASE||require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../index.html')).href;
const OUT=process.env.OUT||__dirname+'/';
const assert=require('node:assert/strict');let passed=0;
const ok=(x,m)=>{assert(x,m);console.log('PASS '+m);passed++};
(async()=>{const b=await chromium.launch();
const mk=async(init={},w=412,h=915)=>{const c=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,serviceWorkers:'block'});await c.addInitScript(s=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('blockbloom_v1',JSON.stringify({seenHint:true,games:5,sv3:1,...s}))}},init);const p=await c.newPage();p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>window.__booted);await p.waitForTimeout(400);return[c,p]};
const st=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('blockbloom_v1')));
const ds=n=>{let d=new Date();d.setDate(d.getDate()-n);return d.toLocaleDateString('en-CA')};
const open=async p=>{await p.click('#themesBtn');await p.waitForTimeout(450)};
for(const [w,h]of [[412,915],[360,800]]){
 const[c,p]=await mk({play:{streak:5,best:5,last:ds(0),got:[3]},dailyStreak:0},w,h);
 ok((await st(p)).skins.includes('jewel'),w+' main 5-day streak unlocks Jewel on load');
 ok(/5-day streak/.test(await p.textContent('#pStreak'))&&/Puzzle streak\s*0/i.test(await p.textContent('#dInfo')),'independent puzzle and play streaks');
 ok(await p.isVisible('#rewardTry'),'celebration has Try it action');
 ok(/AURORA theme in 5 days/.test(await p.textContent('#nextUnlock')),'next streak reward progress');
 await p.screenshot({path:OUT+`streak-live-home-${w}-celebration.png`});
 await p.click('#rewardLater');await p.screenshot({path:OUT+`streak-live-home-${w}.png`});
 ok(await p.evaluate(()=>{let r=document.querySelector('#themesBtn').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight/2}),w+' customisation near top, no clipping');
 ok(await p.isVisible('#themeNew'),'NEW badge before first visit');await open(p);
 ok(await p.locator('[data-k="jewel"] .lk').count()===0,'Jewel tile unlocked');
 await p.click('[data-k="jewel"]');ok((await st(p)).skin==='jewel','Jewel selectable');
 await p.screenshot({path:OUT+`streak-live-themes-${w}.png`});
 await p.reload();await p.waitForFunction(()=>window.__booted);console.log('RELOAD',w,await p.evaluate(()=>({visited:JSON.parse(localStorage.getItem('blockbloom_v1')).themesVisited,new:document.querySelector('#themeNew').hidden,tip:document.querySelector('#themeTip').hidden,seed:sessionStorage.getItem('seeded')})));await p.waitForFunction(()=>document.querySelector('#themeNew').hidden);ok(!(await p.isVisible('#themeNew'))&&!(await p.isVisible('#themeTip')),'badge/tip persist dismissed after visit');
 ok(!(await p.isVisible('#rewardNotice')),'no duplicate celebration on reload');
 await p.evaluate(()=>{let s=JSON.parse(localStorage.getItem('blockbloom_v1'));s.play={streak:0,best:0,last:'2000-01-01',got:[]};s.dailyStreak=0;localStorage.setItem('blockbloom_v1',JSON.stringify(s))});await p.reload();await p.waitForFunction(()=>window.__booted);ok((await st(p)).skins.includes('jewel'),'earned Jewel remains after streak break');ok(!p.errors.length,'no runtime errors');await c.close();
}
for(const init of [{play:{streak:0,best:30,last:'2000-01-01'}},{dailyStreak:30,dailyLast:'2000-01-01'},{dailyBestStreak:30}]){
 const[c,p]=await mk(init);let s=await st(p);ok(s.skins.includes('jewel')&&s.skins.includes('porcelain')&&s.streakRewards.includes('theme:7'),'legacy current/best streak migration');await c.close();
}
for(let d=0;d<=100;d+=10){const[c,p]=await mk({play:{streak:d,best:d,last:ds(0),got:[3,7,14,30]},xp:100000});const s=await st(p);ok(s.streakRewards.filter(r=>r!=='skin:jewel').length===d/10,d+' days earns exactly '+d/10+' ladder rewards (XP cannot bypass)');await open(p);ok(await p.locator('#kGrid .lk').count()===(d<20?5:5-Math.floor(d/20))+(d<3?1:0)+2,'locked skin count at '+d);if(d<100){const next=(d===0?'3':String(d+10))+'-day streak';ok((await p.textContent('#themes')).includes(next),'next threshold label '+next)}await c.close()}
// Initial celebration must disappear when a player starts a game.
{const[c,p]=await mk({play:{streak:3,best:3,last:ds(0),got:[3]}});ok((await st(p)).skins.includes('jewel'),'Jewel unlocks at exactly three days');await p.click('#playBtn',{force:true});ok(!(await p.isVisible('#rewardNotice')),'initial celebration never covers active game');await c.close()}
// Every reward survives a broken streak and is usable without a network.
{const[c,p]=await mk({play:{streak:100,best:100,last:ds(0),got:[3,7,14,30]}});await open(p);await p.screenshot({path:OUT+'streak-all-rewards.png'});await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('blockbloom_v1'));s.play={streak:0,best:0,last:'2000-01-01'};s.dailyStreak=0;s.streakBest=0;localStorage.setItem('blockbloom_v1',JSON.stringify(s))});await p.reload();await p.waitForFunction(()=>window.__booted);await open(p);ok(await p.locator('[data-k="crown"] .lk').count()===0&&await p.locator('[data-i="10"] .lk').count()===0,'100-day skin and 90-day palette stay unlocked after streak break');await p.click('[data-k="crown"]');await p.click('[data-i="10"]');ok((await st(p)).skin==='crown'&&(await st(p)).theme===10,'all-earned reward selection persists');await c.close()}
// Crossing 10 while playing grants a theme without interrupting the board.
{const[c,p]=await mk({play:{streak:9,best:9,last:ds(1),got:[3,7]},streakRewards:['skin:jewel'],skins:['classic','jewel'],tips:{play:1}});await p.click('#playBtn',{force:true});for(let k=0;k<3;k++){await p.evaluate(()=>{for(let i=0;i<3;i++){let m=BB.move(i);if(m){BB.dev.place(i,m.gx,m.gy);break}}});await p.waitForTimeout(80)}ok((await st(p)).streakRewards.includes('theme:6'),'playing third move unlocks 10-day Aurora');ok(!(await p.isVisible('#rewardNotice')),'no popup blocking active game');await p.click('#homeBtn');await p.waitForTimeout(200);if(await p.isVisible('#qEnd'))await p.click('#qEnd');await p.waitForTimeout(400);if(await p.isVisible('#oHome'))await p.click('#oHome');await p.waitForTimeout(400);ok(await p.isVisible('#rewardTry'),'deferred celebration on return home');await p.click('#rewardTry');ok((await st(p)).theme===6,'Try it equips newly earned theme');await c.close()}
await b.close();console.log('ALL PASS '+passed);})().catch(e=>{console.error(e);process.exit(1)});
