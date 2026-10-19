/* Integration checks against the saved real V2 markup and stylesheet.
 * Test-only fixtures never enter the release ZIP. */
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts');
fs.mkdirSync(output, {recursive:true});
const fixtureDir = path.join(root,'tests/fixtures/site');
const pageFixture = fs.existsSync(path.join(fixtureDir,'page.html')) ? path.join(fixtureDir,'page.html') : path.join(root,'page_sample.html');
const cssFixture = fs.existsSync(path.join(fixtureDir,'site.css')) ? path.join(fixtureDir,'site.css') : path.join(root,fs.existsSync(path.join(root,'live_site_sample.css'))?'live_site_sample.css':'site_sample.css');
if (!fs.existsSync(pageFixture)||!fs.existsSync(cssFixture)) throw new Error('Native-site fixtures are not distributed. See tests/README.md for optional browser-test setup.');
let html = fs.readFileSync(pageFixture, 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<link\b[^>]*>/gi, '')
  .replace('ghostsocial-v2 gs-training-pending', 'ghostsocial-v2 gs-v2-ready feed-mode');
html = html.replace('<head>', '<head><link rel="stylesheet" href="/fixture.css">');
const cards = [
  ['mira','Мира','Всё начинается с маленькой идеи.','Сегодня собрала свой первый проект. Люблю, когда интерфейс не мешает, а помогает. ✦'],
  ['north','Север','Место для хороших мыслей.','Оставлю это здесь: иногда нужно просто закрыть лишние вкладки и немного замедлиться.'],
  ['luna','Луна','Вечерний свет','Как проходит ваш октябрь? Делитесь тем, что вдохновляет вас сегодня.']
].map(([user,name,title,text],i) => `<article class="post-card" data-id="${i+1}"><div class="post-header" data-username="${user}"><div class="post-av" style="display:grid;place-items:center;background:${['#75639b','#467a71','#8c5f7c'][i]};width:42px;height:42px;border-radius:50%;color:white">${name[0]}</div><div class="post-info"><div class="post-name">${name}</div><div class="post-user">@${user}</div></div><div class="post-time">${i+1} ч.</div></div><div class="post-content"><h3 style="font-size:22px;font-weight:600;margin:8px 0 12px">${title}</h3><p>${text}</p>${i===0?'<div style="height:180px;border-radius:14px;margin:20px 0;background:radial-gradient(ellipse at 30% 60%,#ac8fda88,transparent 55%),radial-gradient(ellipse at 80% 30%,#74bdba88,transparent 60%),#222337;display:flex;align-items:end;padding:20px;font-size:13px;color:#e0d9f0">make room for something good ↗</div>':''}</div><div class="post-footer"><button>♡ ${12+i*7}</button><button>◌ Обсудить</button><button>↗</button></div></article>`).join('');
html = html.replace('<div id="feedList" data-gs-skeleton="posts" data-gs-count="3"></div>', `<div id="feedList">${cards}</div>`);
html = html.replaceAll('id="appHeader" style="display:none"', 'id="appHeader" style="display:block"')
  .replaceAll('id="appMain" style="display:none"', 'id="appMain" style="display:block"');
// The real site creates the switch under body, outside the feed column.
html = html.replace('</body>','<div id="feedSwitch"><button class="fs-tab" data-screen="screenMinisky">Миниски</button><button class="fs-tab active" data-screen="screenFeed">Посты</button></div></body>');
(async () => {
  const context = await chromium.launchPersistentContext(path.join(output, 'test-browser-profile'), {
    headless:true, channel:'chromium', args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`], viewport:{width:1440,height:1000}
  });
  try {
    const page = await context.newPage();
    const notificationState={fail:false,reads:0,extraPages:0,rows:[
      {id:201,post_id:987,type:'comment',actor_name:'Мира',actor_username:'mira',preview:'Новый комментарий к публикации',is_read:false,created_at:'2026-10-18T12:00:00Z'},
      {id:202,post_id:0,type:'follow',actor_name:'Север',actor_username:'north',preview:'',is_read:false,created_at:'2026-10-18T13:00:00Z'}]};
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['chrome-extension:','blob:','data:'].includes(url.protocol)) return route.continue();
      if (url.pathname === '/v2/social') return route.fulfill({contentType:'text/html',body:html});
      if (/^\/(bank|chat)\//.test(url.pathname)) return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Destination fixture</title>'});
      if (url.pathname === '/fixture.css') return route.fulfill({contentType:'text/css',body:fs.readFileSync(cssFixture,'utf8')});
      if (url.pathname === '/api/soc/prof/mira') return route.fulfill({json:{username:'mira',about:'#GhostPLUS',registered_at:'2026-05-28T12:00:00Z',token:'MUST_NOT_CROSS_BRIDGE',posts:[{created_at:'2025-01-01'}]}});
      if(url.pathname==='/api/soc/prof/north')return route.fulfill({json:{username:'north',posts:[{username:'other',created_at:'2020-01-01'},{username:'north',created_at:'2026-07-04'},{username:'north',created_at:'2026-08-02'}]}});
      if(url.pathname==='/api/soc/com/get/987')return route.fulfill({json:{comments:[{username:'north',created_at:'2026-06-01'}]}});
      if(url.pathname==='/api/soc/prof/old')return route.fulfill({json:{username:'old',posts:Array.from({length:15},()=>({username:'old',created_at:'2026-10-01'}))}});
      if(url.pathname==='/api/soc/prof/old/posts'){notificationState.extraPages++;return route.fulfill({json:Array.from({length:15},()=>({username:'old',created_at:'2026-01-01'}))});}
      if(url.pathname==='/api/soc/notif/unread')return route.fulfill({json:{count:notificationState.rows.filter(n=>!n.is_read).length}});
      if(url.pathname==='/api/soc/notif')return route.fulfill({json:{notifications:notificationState.rows,has_more:false}});
      if(url.pathname==='/api/soc/notif/read') {
        notificationState.reads++;
        if(notificationState.fail)return route.fulfill({status:500,json:{detail:'Fixture failure'}});
        notificationState.rows.forEach(n=>n.is_read=true);return route.fulfill({json:{ok:true}});
      }
      if (url.pathname.endsWith('ghostecos-mark.svg')) return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'icons/icon48.png'))});
      return route.abort();
    });
    await page.goto('https://ghostecos.duckdns.org/v2/social');
    await page.waitForSelector('html.gp-enabled');
    await page.waitForSelector('#dtSideLeft', {state:'visible'});
    await page.waitForFunction(()=>document.getElementById('appHeader').contains(document.getElementById('feedSwitch')));
    await page.evaluate(()=>document.querySelectorAll('#feedSwitch .fs-tab').forEach(button=>button.addEventListener('click',()=>window.switchClicked=button.dataset.screen)));
    await page.locator('#feedSwitch .fs-tab').last().click();
    assert.equal(await page.evaluate(()=>window.switchClicked),'screenFeed','moving toolbar preserves native handlers');
    assert.equal(await page.locator('#gp-panel, .gp-badge, [data-gp-count]').count(),0,'community feature removed');
    await page.evaluate(() => {
      document.querySelectorAll('#appNav [data-screen],#dtSideLeft [data-screen]').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('main > .screen').forEach(s => s.classList.toggle('active', s.id===btn.dataset.screen));
        document.body.classList.toggle('feed-mode', btn.dataset.screen==='screenFeed');
        document.body.classList.toggle('miniska-mode', btn.dataset.screen==='screenMinisky');
        document.body.classList.toggle('profile-mode', btn.dataset.screen==='screenProfile');
      }));
      window.received = [];
      window.addEventListener('ghostplus:profile', e => window.received.push(JSON.parse(e.detail)));
    });
    const response = await page.evaluate(async () => (await fetch('/api/soc/prof/mira')).json());
    assert.equal(response.token, 'MUST_NOT_CROSS_BRIDGE', 'native response preserved');
    await page.waitForFunction(() => window.received.length > 0);
    assert.equal(await page.evaluate(() => window.received[0].token), undefined, 'token not relayed');
    assert.equal(await page.evaluate(() => window.received[0].about), undefined, 'biography no longer relayed');
    await page.evaluate(() => {
      document.getElementById('fpUser').textContent = '@mira';
      document.getElementById('fpName').textContent = 'Мира';
    });
    await page.waitForFunction(() => document.querySelector('#fpUser + .gp-registration')?.textContent.includes('28 мая 2026'));
    await page.evaluate(() => { document.getElementById('fpUser').textContent='@north'; });
    await page.waitForFunction(() => document.querySelector('#fpUser + .gp-registration')?.textContent.includes('Недостаточно данных'));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ghostplus:profile',{detail:JSON.stringify({username:'north',about:'<img src=x onerror=alert(1)>',registered_at:'not-a-date'})})));
    assert.equal(await page.locator('.gp-registration img').count(), 0);
    assert.equal(await page.locator('.gp-badge').count(), 0, 'marker in profile has no effect');
    await page.keyboard.press('Alt+Shift+KeyN');
    assert(await page.locator('#screenCreate').evaluate(el => el.classList.contains('active')));
    await page.keyboard.press('Alt+Shift+KeyF'); // textarea focus must not steal input
    assert(await page.locator('#screenCreate').evaluate(el => el.classList.contains('active')));
    await page.locator('#postText').evaluate(el => el.blur());
    await page.keyboard.press('Alt+Shift+KeyF');
    assert(await page.locator('#screenSearch').evaluate(el => el.classList.contains('active')));
    await page.evaluate(() => {
      document.querySelectorAll('main > .screen').forEach(s => s.classList.toggle('active', s.id==='screenFeed'));
      document.body.classList.add('feed-mode');
      document.activeElement.blur();
    });
    for (const width of [1100,1150,1280,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      const boxes = await page.evaluate(() => ['dtSideLeft','appMain'].map(id => {
        const r = document.getElementById(id).getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width};
      }));
      assert(boxes[0].right <= boxes[1].left, `left overlap at ${width}`);
      assert(boxes[1].right <= width, `overflow at ${width}`);
    }
    // Hidden tabs must not leave the old fixed-height gap below the header.
    for (const width of [390,900,1440]) {
      await page.setViewportSize({width,height:1000});
    for (const hidden of [true,false]) {
      await page.evaluate(hidden=>document.getElementById('feedSwitch').style.setProperty('display',hidden?'none':'flex','important'),hidden);
      await page.waitForFunction(()=>Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--gp-header-space'))-document.getElementById('appHeader').getBoundingClientRect().height)<1);
      const gap=await page.evaluate(()=>document.querySelector('#feedList .post-card').getBoundingClientRect().top-document.getElementById('appHeader').getBoundingClientRect().bottom);
      assert(gap>=0 && gap<=16,`header gap with tabs hidden=${hidden}: ${gap}`);
    }
    }
    await page.evaluate(()=>document.getElementById('feedSwitch').style.removeProperty('display'));
    // Sorting remains native; the enhancement reflects the changed state.
    await page.evaluate(()=>{
      document.querySelectorAll('#headerFilters .filter-btn').forEach(button=>button.addEventListener('click',()=>{
        document.querySelectorAll('#headerFilters .filter-btn').forEach(other=>other.classList.toggle('active',other===button));
        window.chosenSort=button.textContent;
      }));
    });
    await page.setViewportSize({width:390,height:844});
    await page.locator('#headerFilters .filter-btn').last().click();
    await page.waitForFunction(()=>document.querySelector('#headerFilters .filter-btn:last-child').getAttribute('aria-pressed')==='true');
    assert(await page.evaluate(()=>!!window.chosenSort),'native sort handler preserved');
    assert.equal(await page.locator('#headerFilters button[aria-pressed="true"]').count(),1);
    const selectedFilter=await page.locator('#headerFilters .filter-btn.active').boundingBox();
    assert(selectedFilter.width>=62 && selectedFilter.height>=36,'filter target size');
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#headerFilters').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished))});
    await page.locator('#headerFilters').screenshot({path:path.join(output,'tabs-preview.png')});
    assert.equal(await page.locator('#dtSideLeft a[href^="/bank/"]').isVisible(),false,'Bank button removed');
    assert.equal(await page.locator('#dtChatLink').isVisible(),false,'Chat button removed');
    await page.evaluate(()=>window.switchScreen=id=>{
      document.querySelector('#appNav [data-screen="'+id+'"]')?.click();
      if(id!=='screenCreate')document.getElementById('mskCompose')?.classList.remove('show');
    });
    // Back preserves the existing textarea and its contents.
    await page.locator('#dtSideLeft [data-screen="screenCreate"]').click();
    await page.locator('#postText').fill('Сохранить мой черновик');
    await page.locator('#screenCreate .gp-create-back').click();
    assert(await page.locator('#screenFeed').evaluate(el=>el.classList.contains('active')));
    assert.equal(await page.locator('#postText').inputValue(),'Сохранить мой черновик');
    await page.evaluate(()=>{
      const overlay=document.createElement('div');overlay.id='mskCompose';overlay.className='show';
      overlay.innerHTML='<div class="mskc-tabs"><button class="mskc-tab active">Пост</button><button class="mskc-tab">Миниска</button></div><div class="mskc-stage" id="mskcPostPanel" style="display:block"></div>';
      overlay.querySelector('#mskcPostPanel').append(document.querySelector('.create-card'));document.body.append(overlay);
    });
    await page.waitForSelector('#mskCompose > .gp-create-back');
    await page.locator('#mskCompose').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished))});
    await page.screenshot({path:path.join(output,'composer-preview.png')});
    await page.setViewportSize({width:390,height:844});
    const composerBoxes=await page.evaluate(()=>{
      const back=document.querySelector('#mskCompose > .gp-create-back').getBoundingClientRect();const tabs=document.querySelector('#mskCompose .mskc-tabs').getBoundingClientRect();
      return {right:back.right,left:tabs.left,scroll:document.getElementById('mskcPostPanel').scrollWidth,width:document.getElementById('mskcPostPanel').clientWidth};
    });
    assert(composerBoxes.right<=composerBoxes.left,'mobile Back does not overlap tabs');
    assert(composerBoxes.scroll<=composerBoxes.width,'composer has no horizontal scroll');
    await page.setViewportSize({width:1920,height:1000});
    await page.locator('#mskCompose > .gp-create-back').click();
    assert.equal(await page.locator('#mskCompose.show').count(),0,'Back closes native dynamic composer through switchScreen');
    assert.equal(await page.locator('#postText').inputValue(),'Сохранить мой черновик');
    await page.evaluate(()=>{
      document.getElementById('screenCreate').append(document.querySelector('.create-card'));document.getElementById('mskCompose').remove();
      const card=document.querySelector('#feedList .post-card');
      const like=document.createElement('button');like.dataset.action='react-toggle';like.innerHTML='<i>♡</i><span>12</span>';card.querySelector('.post-footer').append(like);
      like.addEventListener('click',()=>like.classList.toggle('liked'));
      const heart=document.createElement('div');heart.className='dt-heart go';heart.innerHTML='<svg viewBox="0 0 24 24"><path fill="#f27889" d="M12 21 3 12C-3 4 8-1 12 6 16-1 27 4 21 12Z"/></svg>';card.append(heart);
    });
    const heartPosition=await page.locator('#feedList .dt-heart').evaluate(el=>({position:getComputedStyle(el).position,events:getComputedStyle(el).pointerEvents}));
    assert.deepEqual(heartPosition,{position:'absolute',events:'none'});
    const beforeHeight=await page.locator('#feedList .post-card').first().evaluate(el=>el.getBoundingClientRect().height);
    await page.locator('[data-action="react-toggle"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-action="react-toggle"] i').getAnimations().length>0);
    assert.equal(await page.locator('#feedList .post-card').first().evaluate(el=>el.getBoundingClientRect().height),beforeHeight,'like does not shift the post');
    await page.locator('#feedList .dt-heart').evaluate(el=>el.remove());
    // Real report panel structure and inline styles from the native app.
    await page.evaluate(()=>{
      const overlay=document.createElement('div');overlay.id='reportSheet';overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:#0009;display:flex;align-items:flex-end;justify-content:center';
      overlay.innerHTML='<div style="background:#0f172a;width:100%;max-width:520px;padding:14px;border-radius:18px 18px 0 0"><div style="height:4px"> </div><h3>Причина жалобы</h3><div id="reportOpts"><button data-reason="spam">Спам или реклама</button><button data-reason="nsfw">18+ без блюра</button><button data-reason="illegal">Незаконный контент</button><button data-reason="harassment">Травля или угрозы</button><button data-reason="other">Другое</button></div><button id="reportCancel">Отмена</button></div>';
      overlay.querySelectorAll('[data-reason]').forEach(button=>button.style.cssText='display:flex;align-items:center;width:100%;padding:14px 16px;background:transparent;border:0');
      overlay.querySelector('#reportCancel').addEventListener('click',()=>overlay.remove());document.body.append(overlay);
    });
    const reportBounds=await page.locator('#reportSheet > div').boundingBox();
    assert(reportBounds.y>0 && reportBounds.y+reportBounds.height<1000);
    await page.screenshot({path:path.join(output,'report-preview.png')});
    await page.locator('#reportCancel').click();assert.equal(await page.locator('#reportSheet').count(),0);
    await page.evaluate(()=>{
      const media=document.createElement('div');media.className='post-media';
      media.innerHTML='<div class="audio-widget gs-audio-card"><div class="gs-audio-art">♪</div><div class="gs-audio-main"><div class="gs-audio-meta"><div class="gs-audio-title">Тестовая аудиозапись</div><div class="gs-audio-artist">GhostSocial</div></div><div class="gs-audio-controls"><button class="audio-play-btn" aria-label="Воспроизвести аудио">▶</button><div class="audio-waveform">'+Array.from({length:64},(_,i)=>'<i class="audio-bar" style="--bar-height:'+(20+i%7*10)+'%"></i>').join('')+'</div></div><div class="gs-audio-bottom"><div class="audio-time">1:54</div></div></div></div>';
      media.querySelector('.audio-play-btn').addEventListener('click',()=>window.audioClicked=true);document.querySelector('#feedList .post-card').append(media);
    });
    await page.locator('.gs-audio-card .audio-play-btn').click();assert(await page.evaluate(()=>window.audioClicked),'audio controls retain handlers');
    const audioBounds=await page.locator('.gs-audio-card').evaluate(el=>{const widget=el.getBoundingClientRect();return [...el.querySelectorAll('.gs-audio-art,.gs-audio-main,.audio-play-btn,.audio-waveform')].every(child=>{const r=child.getBoundingClientRect();return r.left>=widget.left && r.right<=widget.right})});
    assert(audioBounds,'audio content stays within panel');
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('.post-card').first().evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
    await page.screenshot({path:path.join(output,'desktop-preview.png')});
    await page.setViewportSize({width:1280,height:800});
    await page.locator('.post-card').first().evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
    await page.evaluate(() => {
      const label = document.createElement('div'); label.id='fixture-label'; label.textContent='Демонстрационные публикации';
      label.style.cssText='position:fixed;bottom:8px;right:12px;font:10px system-ui;color:#999;background:#111d;padding:5px 8px;z-index:9999;border-radius:5px'; document.body.append(label);
    });
    await page.screenshot({path:path.join(output,'store-screenshot-1280x800.png')});
    await page.locator('#fixture-label').evaluate(el => el.remove());
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#gp-panel').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.post-card').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.setViewportSize({width:1440,height:1000});
    // Real native Minisky DOM: carousel sizing, aspect fit, controls and tab origin.
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(async () => {
      const feed = document.getElementById('mskFeed');
      feed.innerHTML='<div class="msk-card" data-id="1"><div class="mskc-ftrack"><div class="mskc-fslide"><video playsinline muted></video></div><div class="mskc-fslide"><img alt="Второй кадр"></div></div><div class="mskc-vslider"><div class="mskc-vslider-fill"></div></div><div class="msk-play-overlay"></div><div class="msk-overlay"><div class="msk-info"><div class="author"><div class="av">М</div><div><div class="name">Мира</div><div class="un">@mira</div></div></div><div class="caption">Проверка вертикального видео</div></div></div><div class="msk-side"><button class="msk-play-btn" aria-label="Пауза">Ⅱ</button><button aria-label="Нравится">♡</button><div class="lbl">12</div><button aria-label="Комментарии">◌</button><div class="lbl">3</div><button aria-label="Поделиться">↗</button></div></div>';
      const canvas=document.createElement('canvas'); canvas.width=360; canvas.height=640;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='#32254b';ctx.fillRect(0,0,360,640);
      ctx.fillStyle='#b39af4';ctx.fillRect(24,24,312,592);ctx.fillStyle='#211a30';ctx.fillRect(28,28,304,584);
      ctx.fillStyle='#f1f1f4';ctx.font='24px system-ui';ctx.fillText('360 × 640',110,320);
      const video=feed.querySelector('video');video.poster=canvas.toDataURL();
      feed.querySelector('.mskc-fslide img').src=canvas.toDataURL();
      video.srcObject=canvas.captureStream(10);
      await video.play();
      document.querySelector('#dtSideLeft [data-screen="screenMinisky"]').click();
    });
    for (const width of [1100,1280,1440,1920]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const geometry=await page.evaluate(() => {
        const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        return {stage:rect(document.getElementById('screenMinisky')),header:rect(document.getElementById('feedSwitch')),media:rect(document.querySelector('#mskFeed video')),slide:rect(document.querySelector('#mskFeed .mskc-fslide')),actions:rect(document.querySelector('#mskFeed .msk-side')),fit:getComputedStyle(document.querySelector('#mskFeed video')).objectFit};
      });
      assert.equal(geometry.stage.height,900);
      assert.equal(geometry.media.height,geometry.stage.height);
      assert.equal(geometry.slide.width,geometry.stage.width);
      assert.equal(geometry.fit,'contain');
      for (const part of [geometry.header,geometry.media,geometry.actions]) {
        assert(part.left>=geometry.stage.left-1 && part.right<=geometry.stage.right+1,`minisky bounds at ${width}: ${JSON.stringify(geometry)}`);
        assert(part.top>=-1 && part.bottom<=901,`minisky vertical bounds at ${width}`);
      }
      assert.equal(await page.locator('#dtSideLeft .dt-nav-btn.active').count(),1,'exactly one selected nav');
    }
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:path.join(output,'video-preview.png')});
    await page.evaluate(() => {
      const track=document.querySelector('#mskFeed .mskc-ftrack');track.style.transform='translateX(-100%)';
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').fillRect(0,0,640,360);
      const image=document.querySelector('#mskFeed .mskc-fslide img');image.src=canvas.toDataURL();image.classList.add('mskc-fit-landscape');
    });
    await page.waitForFunction(()=>Math.abs(document.querySelectorAll('#mskFeed .mskc-fslide')[1].getBoundingClientRect().left-document.getElementById('screenMinisky').getBoundingClientRect().left)<1);
    assert.equal(await page.locator('#mskFeed .mskc-fit-landscape').evaluate(el=>getComputedStyle(el).objectFit),'contain','landscape slide retains full image');
    await page.evaluate(() => {
      document.getElementById('profName').textContent='Мира';document.getElementById('profUser').textContent='@mira';
      document.getElementById('profAv').textContent='М';
      const bio=document.getElementById('profBio');bio.hidden=false;bio.textContent='Маленькие идеи и большие планы.';
      document.getElementById('sFollowing').textContent='24';document.getElementById('sFollowers').textContent='128';document.getElementById('sReceived').textContent='360';
      document.querySelector('#dtSideLeft [data-screen="screenProfile"]').click();
    });
    await page.locator('#screenProfile .profile-card').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished))});
    await page.evaluate(()=>{
      const tabs=document.querySelector('#screenProfile .gs-profile-tabs');
      for(const [key,label] of [['saved','Сохранённое'],['reacted','Реакции']]) {const button=document.createElement('button');button.className='prof-tab';button.dataset.tab=key;button.setAttribute('aria-label',label);tabs.append(button);}
    });
    await page.waitForSelector('#screenProfile .gp-tab-label');
    await page.evaluate(()=>document.querySelectorAll('#screenProfile .prof-tab').forEach(tab=>{
      tab.removeAttribute('onclick');tab.addEventListener('click',()=>{
        document.querySelectorAll('#screenProfile .prof-tab').forEach(other=>other.classList.toggle('active',other===tab));window.profileTabClicked=tab.dataset.tab;
      });
    }));
    await page.locator('#screenProfile .prof-tab').last().click();
    await page.waitForFunction(()=>document.querySelector('#screenProfile .prof-tab:last-child').getAttribute('aria-pressed')==='true');
    assert(await page.evaluate(()=>!!window.profileTabClicked),'profile tabs keep handlers');
    await page.setViewportSize({width:390,height:900});
    const profileTabFit=await page.locator('#screenProfile .gs-profile-tabs').evaluate(el=>[...el.children].every(child=>child.getBoundingClientRect().right<=el.getBoundingClientRect().right+1));assert(profileTabFit,'four profile tabs fit on mobile');
    await page.setViewportSize({width:1440,height:900});
    const avatarGap=await page.evaluate(()=>document.querySelector('#screenProfile .gs-profile-body').getBoundingClientRect().top-document.getElementById('profAv').getBoundingClientRect().bottom);
    assert(avatarGap>=0 && avatarGap<=20,`profile avatar gap: ${avatarGap}`);
    const statRows=await page.locator('#screenProfile .stat-box:not(.gs-profile-hidden-count)').evaluateAll(nodes=>nodes.map(el=>Math.round(el.getBoundingClientRect().top)));
    assert.equal(new Set(statRows).size,1,'profile stats aligned');
    await page.screenshot({path:path.join(output,'profile-preview.png')});
    // Public profile with media banner, status and both action buttons, as in the report.
    await page.evaluate(()=>{
      document.querySelectorAll('main > .screen').forEach(screen=>screen.classList.toggle('active',screen.id==='screenFullProfile'));
      document.getElementById('fpName').textContent='Мира';document.getElementById('fpUser').textContent='@mira';document.getElementById('fpAv').textContent='М';
      document.getElementById('fpMediaBanner').hidden=false;
      document.getElementById('fpFollowWrap').style.display='block';document.getElementById('fpMessageWrap').style.display='block';document.getElementById('fpFollowBtn').textContent='Подписаться';
      document.getElementById('fpFollowers').textContent='128';document.getElementById('fpFollowing').textContent='24';document.getElementById('fpReceived').textContent='360';
      document.getElementById('fpBio').hidden=false;document.getElementById('fpBio').textContent='Маленькие идеи и большие планы.';
    });
    await page.locator('#screenFullProfile .profile-card').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished))});
    const publicGap=await page.evaluate(()=>document.querySelector('#screenFullProfile .gs-profile-body').getBoundingClientRect().top-document.getElementById('fpAv').getBoundingClientRect().bottom);
    assert(publicGap>=0 && publicGap<=20,`public media profile gap: ${publicGap}`);
    const actionWidths=await page.evaluate(()=>['fpFollowBtn','fpMessageBtn'].map(id=>document.getElementById(id).getBoundingClientRect().width));
    assert(Math.abs(actionWidths[0]-actionWidths[1])<2,'profile actions have equal widths');
    await page.screenshot({path:path.join(output,'public-profile-preview.png')});
    await page.evaluate(() => {
      const overlay=document.createElement('div');overlay.id='gsMenuOverlay';overlay.className='open';document.body.append(overlay);
      const menu=document.createElement('div');menu.id='gsMenuPanel';menu.className='open';
      menu.innerHTML='<div class="gsm-page"><div class="gsm-head"><div class="gsm-av">М</div><div><div class="gsm-name">Мира</div><div class="gsm-un">@mira</div></div></div><button class="gsm-item"><span>Аккаунт</span><i class="chev">›</i></button><button class="gsm-item"><span>Сервисы</span><i class="chev">›</i></button><button class="gsm-item"><span>Инструменты</span><i class="chev">›</i></button><button class="gsm-item"><span>Настройки</span><i class="chev">›</i></button></div><div class="gsm-foot"><button class="gsm-install">Установить как приложение</button></div>';
      menu.querySelector('.gsm-item').addEventListener('click',()=>window.menuClicked=true);document.body.append(menu);
    });
    await page.locator('#gsMenuPanel').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished))});
    await page.locator('#gsMenuPanel .gsm-item:not(.gp-view-profile)').first().click();assert(await page.evaluate(()=>window.menuClicked),'menu handlers preserved');
    const menuBox=await page.locator('#gsMenuPanel').boundingBox();assert(Math.abs(menuBox.y+menuBox.height/2-450)<2,'menu vertically centered');
    await page.screenshot({path:path.join(output,'menu-preview.png')});
    await page.locator('.gp-view-profile').click();
    assert(await page.locator('#screenProfile').evaluate(el=>el.classList.contains('active')),'view profile navigates');
    assert.equal(await page.locator('#gsMenuPanel.open').count(),0,'view profile closes menu');
    await page.evaluate(()=>{document.getElementById('gsMenuPanel').remove();document.getElementById('gsMenuOverlay').remove()});
    // Native API fixture: uses the actual fetch adapter, no credentials involved.
    await page.evaluate(()=>{
      window.api=async(path,method='GET')=>{const response=await fetch('/api/soc'+path,{method});if(!response.ok)throw new Error('Fixture API failure');return response.json();};
      window.openSinglePost=id=>{window.openedPost=id;document.getElementById('navFeed').click();};
      window.openFullProfile=user=>{window.openedProfile=user;};
    });
    await page.evaluate(()=>window.api('/prof/north'));
    await page.evaluate(()=>{document.getElementById('fpUser').textContent='@north';});
    await page.waitForFunction(()=>document.querySelector('#fpUser + .gp-registration').textContent.includes('4 июля 2026'));
    assert((await page.locator('#fpUser + .gp-registration').textContent()).startsWith('Создан примерно'),'estimate has requested wording');
    await page.evaluate(()=>window.api('/com/get/987'));
    await page.waitForFunction(()=>document.querySelector('#fpUser + .gp-registration').textContent.includes('1 июня 2026'));
    const finalEstimatePage=page.waitForResponse(response=>response.url().includes('/api/soc/prof/old/posts?offset=45'));
    await page.evaluate(()=>window.api('/prof/old'));
    await finalEstimatePage;
    await page.waitForFunction(()=>document.querySelector('#fpUser + .gp-registration').textContent.includes('1 июня 2026'));
    await page.waitForFunction(()=>{document.getElementById('fpUser').textContent='@old';return document.querySelector('#fpUser + .gp-registration').textContent.includes('1 января 2026');});
    assert.equal(notificationState.extraPages,3,'estimation pagination bounded');
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>{globalThis.createdNotices=[];chrome.notifications.create=async(id,options)=>{globalThis.createdNotices.push({id,options});return id;};});
    await page.evaluate(()=>window.api('/notif/unread'));
    await page.waitForSelector('.gp-notification-item');
    assert.equal(await page.locator('.gp-notif-count').textContent(),'2');
    assert.equal(await page.locator('.gp-notification-item').count(),2);
    await page.locator('.gp-notification-item').filter({hasText:'Мира'}).click();
    await page.waitForFunction(()=>window.openedPost===987);
    assert.equal(await page.locator('.gp-notif-count').textContent(),'1','clicked notification is locally read');
    await page.evaluate(async()=>{
      const data=await window.api('/notif?offset=0');
      const list=document.getElementById('notifList');list.replaceChildren();
      data.notifications.forEach(n=>{const row=document.createElement('div');row.className='notif-card'+(!n.is_read?' unread':'');row.textContent=n.actor_name;list.append(row);});
      document.getElementById('navNotif').click();
    });
    await page.waitForSelector('#notifList .gp-unread');
    assert.equal(await page.locator('#notifList .gp-unread').count(),1);
    const tint=await page.locator('#notifList .gp-unread').first().evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.notEqual(tint,'rgba(0, 0, 0, 0)','unread rows highlighted');
    const automaticBlocked=await page.evaluate(async()=>{try{await window.api('/notif/read','POST');return false;}catch(_){return true;}});
    assert(automaticBlocked);assert.equal(notificationState.reads,0,'opening notifications does not write read markers');
    await page.screenshot({path:path.join(output,'notification-page-preview.png')});
    await page.evaluate(()=>document.getElementById('navFeed').click());
    await page.screenshot({path:path.join(output,'notification-tray-preview.png')});
    notificationState.fail=true;
    await page.locator('.gp-notifications-footer button').last().click();
    await page.waitForSelector('.gp-notification-error');
    assert.equal(await page.locator('.gp-notif-count').textContent(),'1','failed read keeps unread count');
    notificationState.fail=false;
    await page.locator('.gp-notifications-footer button').last().click();
    await page.waitForFunction(()=>document.querySelector('.gp-notif-count').hidden);
    assert.equal(await page.locator('#notifList .gp-unread,#notifList .unread').count(),0);
    notificationState.rows.push({id:203,post_id:777,type:'mention',actor_name:'Луна',actor_username:'luna',preview:'<img src=x onerror=alert(1)>',is_read:false,created_at:'2026-10-18T14:00:00Z'});
    await page.evaluate(()=>window.api('/notif/unread'));
    await page.waitForFunction(()=>document.querySelector('.gp-notif-count').textContent==='1');
    await page.waitForSelector('.gp-notification-item');
    assert.equal(await page.locator('.gp-notification-item img').count(),0,'notification previews are text only');
    assert((await page.locator('.gp-notification-item').textContent()).includes('<img'),'new event appears after server count update');
    const created=await worker.evaluate(async()=>{for(let i=0;i<100&&!globalThis.createdNotices.length;i++)await new Promise(resolve=>setTimeout(resolve,20));return globalThis.createdNotices;});
    assert.equal(created.length,1,'only new notifications reach Windows API');
    assert.equal(created[0].options.silent,false,'Windows notification sound enabled');
    const chatPage=await context.newPage();
    await context.route('https://ghostecos.duckdns.org/chat/badge-test',route=>route.fulfill({contentType:'text/html',body:'<div class="chat-name"><span class="user-badges"><span class="ub-verified">✓</span></span>Мира</div>'}));
    await chatPage.goto('https://ghostecos.duckdns.org/chat/badge-test');await chatPage.waitForSelector('html.gp-enabled');
    assert.equal(await chatPage.locator('.user-badges').evaluate(el=>getComputedStyle(el).order),'2','platform badge follows chat name');
    await chatPage.close();
    await context.route('**/api/soc/status/my',route=>route.fulfill({json:{must_set:true,status:''}}));
    const statusResult=await page.evaluate(()=>window.api('/status/my'));
    assert.equal(statusResult.must_set,false,'daily forced status prompt suppressed');
    await page.evaluate(()=>{
      window.openStatusModal=()=>{const modal=document.createElement('div');modal.id='dailyStatusModal';modal.innerHTML='<div><p>Обязательный ежедневный статус</p></div>';document.body.append(modal);};
      document.getElementById('navProfile').click();
    });
    await page.locator('.gp-status-suggestion').click();await page.waitForSelector('.gp-status-cancel');
    await page.locator('.gp-status-cancel').click();assert.equal(await page.locator('#dailyStatusModal').count(),0,'status editing is voluntary and dismissible');
    await page.evaluate(()=>{
      const comments=document.getElementById('commentsList');comments.innerHTML='<div class="comment-item"><div class="comment-item-row"><div class="comment-item-body"><div class="comment-author"><span class="comment-name">Мира</span><span class="user-badges"><span class="ub-verified">✓</span></span></div><div class="comment-text">Обновлённое оформление комментариев</div><button class="com-reply">Ответить</button></div></div></div>';
      comments.querySelector('.com-reply').addEventListener('click',()=>window.replyClicked=true);
      document.getElementById('commentsModal').classList.add('open');
      const loader=document.createElement('div');loader.className='loader';loader.id='test-loader';loader.innerHTML='<span class="spinner"></span> Загрузка…';comments.append(loader);
    });
    await page.locator('.com-reply').click();assert(await page.evaluate(()=>window.replyClicked),'comment reply handler preserved');
    assert(await page.locator('#test-loader .spinner').evaluate(el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0),'loading spinner visible');
    const badgeOrder=await page.locator('.comment-author .user-badges').evaluate(el=>getComputedStyle(el).order);assert.equal(badgeOrder,'2');
    await page.screenshot({path:path.join(output,'comments-preview.png')});
    await page.evaluate(()=>document.getElementById('commentsModal').classList.remove('open'));
    await page.evaluate(()=>{
      const editor=document.getElementById('bannerEditorModal');editor.classList.add('open');
      const sources=document.getElementById('gsBannerSources');
      for(let i=1;i<=8;i++) {
        const card=document.createElement('div');card.className='gs-banner-source-card';
        const label=document.createElement('strong');label.textContent='Источник '+i;
        const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value='70';slider.setAttribute('aria-label','Сила источника '+i);
        slider.addEventListener('input',()=>window.bannerSliderChanged=true);card.append(label,slider);sources.append(card);
      }
      document.getElementById('gsBannerSave').addEventListener('click',()=>window.bannerSaveClicked=true);
    });
    await page.locator('#bannerEditorModal').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished))});
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:900});
      const editorGeometry=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
        return{sheet:rect('#bannerEditorModal .gs-banner-editor-sheet'),preview:rect('#gsBannerEditorPreview'),footer:rect('#bannerEditorModal .gs-banner-editor-footer')};
      });
      assert(editorGeometry.sheet.top>=0&&editorGeometry.sheet.bottom<=900);
      assert(editorGeometry.preview.height<=221,'banner preview bounded');
      assert(editorGeometry.footer.bottom<=900,'banner footer visible');
    }
    await page.locator('#gsBannerSources input').first().fill('35');assert(await page.evaluate(()=>window.bannerSliderChanged),'native range handlers preserved');
    await page.locator('#gsBannerSave').click();assert(await page.evaluate(()=>window.bannerSaveClicked),'native save handler preserved');
    await page.screenshot({path:path.join(output,'banner-editor-preview.png')});
    await page.evaluate(()=>document.getElementById('bannerEditorModal').classList.remove('open'));
    // Real profile selectors: readable posts, media, polls and full-width loading
    // in both own/public profiles, including after a tab replaces list contents.
    const profileCards = cards + '<article class="post-card"><div class="post-header">Автор</div><div class="post-content">'+ 'Длинный текст публикации без обрезки. '.repeat(50) + '<div class="poll"><button class="poll-opt">Вариант опроса</button></div></div><div class="media-grid g1"><div class="mg-item"><img width="360" height="640" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22360%22 height=%22640%22%3E%3Crect width=%22360%22 height=%22640%22 fill=%22%2375639b%22/%3E%3C/svg%3E"></div></div><div class="post-footer"><button>Ответить</button></div></article>';
    for(const listId of ['profList','fpList']) {
      await page.evaluate(({listId,profileCards})=>{
        document.body.classList.remove('feed-mode','miniska-mode');
        document.querySelectorAll('#appMain > .screen').forEach(screen=>screen.classList.toggle('active',screen.id===(listId==='profList'?'screenProfile':'screenFullProfile')));
        document.getElementById(listId).innerHTML=profileCards;
      },{listId,profileCards});
      await page.locator('#'+listId+' .media-grid img').evaluate(img=>img.decode());
      await page.locator('#'+listId).evaluate(async list=>{
        await Promise.all(list.closest('.screen').getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished));
      });
      for(const width of [390,900,1440]) {
        await page.setViewportSize({width,height:1000});
        await page.waitForFunction(width=>innerWidth===width,width);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const geometry=await page.locator('#'+listId).evaluate(list=>{
          const bounds=list.getBoundingClientRect();
          return [...list.children].map(card=>{
            const r=card.getBoundingClientRect(),text=card.querySelector('.post-content'),footer=card.querySelector('.post-footer');
            return {left:r.left,right:r.right,width:r.width,available:bounds.width,top:r.top,bottom:r.bottom,textVisible:getComputedStyle(text).display!=='none',textFits:text.scrollHeight<=text.clientHeight+1,footerVisible:getComputedStyle(footer).display!=='none',footerBottom:footer.getBoundingClientRect().bottom};
          });
        });
        geometry.forEach((g,i)=>{
          assert(g.width>g.available-45,`${listId} post takes full column at ${width}`);
          assert(g.left>=0&&g.right<=width+1,'profile posts fit viewport '+JSON.stringify({listId,width,g}));
          assert(g.textVisible&&g.textFits&&g.footerVisible&&g.footerBottom<=g.bottom,'post text and controls not clipped');
          if(i)assert(g.top>=geometry[i-1].bottom,'posts follow vertically');
        });
      }
      await page.locator('#'+listId).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,listId+'-feed-preview.png')});
      for(const tab of ['posts','reposts','saved','reacted']) {
        await page.locator('#'+listId).evaluate((list,tab)=>{
          list.dataset.testTab=tab;
          list.innerHTML='<div class="skel-post"><div class="skel-row"><div class="skel skel-av"></div><div class="skel skel-name"></div></div><div class="skel skel-line"></div></div><div class="gs-skel-post"><div class="skel skel-line"></div></div>';
        },tab);
        const widths=await page.locator('#'+listId).evaluate(list=>[...list.children].map(el=>({width:el.getBoundingClientRect().width,list:list.clientWidth,left:el.offsetLeft})));
        widths.forEach(g=>assert(g.width>g.list-45,'loading fills the profile column on '+tab));
      }
      await page.screenshot({path:path.join(output,listId+'-loading-preview.png')});
    }
    await page.evaluate(()=>{
      document.body.classList.add('feed-mode');
      document.querySelectorAll('#appMain > .screen').forEach(s=>s.classList.toggle('active',s.id==='screenFeed'));
      window.scrollTo(0,0);
    });
    for(const width of [390,900,1440]) {
      await page.setViewportSize({width,height:1000});
      const toolbar=await page.locator('#feedSwitch').evaluate(el=>{
        const a=el.getBoundingClientRect(),b=document.getElementById('appHeader').getBoundingClientRect();
        return{center:a.left+a.width/2,headerCenter:b.left+b.width/2,width:a.width,headerWidth:b.width,buttonWidths:[...el.querySelectorAll('.fs-tab')].map(b=>b.getBoundingClientRect().width)};
      });
      assert(Math.abs(toolbar.center-toolbar.headerCenter)<2,'switch centered in content column');
      assert(toolbar.width<=toolbar.headerWidth,'switch fits header');
      assert(Math.abs(toolbar.buttonWidths[0]-toolbar.buttonWidths[1])<2,'switch buttons equal width');
    }
    await page.locator('#appHeader').screenshot({path:path.join(output,'feed-switch-preview.png')});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(() => document.getElementById('appMain').style.display='none');
    await page.waitForFunction(() => !document.documentElement.classList.contains('gp-app-ready'));
    assert.equal(await page.locator('#dtSideLeft').isVisible(), false, 'no navigation on login screen');
    assert.deepEqual(errors, []);
    // Obtain the installed extension ID from Chromium's extension manager.
    const manager = await context.newPage(); await manager.goto('chrome://extensions');
    const id = await manager.locator('extensions-item').evaluateAll(items => items.find(el => el.data?.name?.startsWith('GhostPLUS'))?.id);
    assert(id, 'extension installed');
    const popup = await context.newPage(); popup.on('pageerror', e => console.log('POPUP ERROR',e.message)); await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    await popup.waitForFunction(() => !document.querySelector('[data-setting="enabled"]').disabled);
    await popup.locator('[data-accent="mint"]').click();
    await popup.waitForFunction(() => document.getElementById('status').textContent==='Сохранено');
    await page.waitForFunction(() => document.documentElement.dataset.gpAccent==='mint');
    await popup.locator('[data-setting="enabled"]').uncheck();
    await page.waitForFunction(() => !document.documentElement.classList.contains('gp-enabled'));
    await page.waitForFunction(()=>document.getElementById('feedSwitch').parentElement===document.body);
    assert.equal(await page.locator('.gp-badge').count(), 0);
    await popup.locator('#reset').click();
    await page.waitForFunction(() => document.documentElement.classList.contains('gp-enabled'));
    await popup.setViewportSize({width:364,height:600});
    await popup.screenshot({path:path.join(output,'settings-preview.png'),fullPage:true});
    const promo = await context.newPage(); await promo.setViewportSize({width:440,height:280});
    await promo.setContent(fs.readFileSync(path.join(root,'store/promo.html'),'utf8').replace('../icons/icon128.png', 'data:image/png;base64,'+fs.readFileSync(path.join(root,'icons/icon128.png')).toString('base64')));
    await promo.screenshot({path:path.join(root,'store/promo-440x280.png')});
    assert.equal(await popup.locator('[data-setting="showBadges"],[data-setting="focusMode"]').count(),0,'obsolete settings removed');
    console.log('PASS: approximate date wording + evidence; local read on click and server read-all; Windows API payload/sound/new-event dedup; native Back closes composer; service buttons hidden; platform badges after names in chat/comments; loading spinner and comment reply; voluntary status prompt; banner editor; responsive tabs/profile; native handlers and popup.');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
