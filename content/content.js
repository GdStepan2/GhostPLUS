(() => {
  'use strict';
  const {defaults, normalize} = GhostPlusSettings;
  let settings = {...defaults}, scheduled = false;
  const profiles = new Map();
  const root = document.documentElement;
  let previousScreen = 'screenFeed', currentScreen = '';
  let departureDialog, departureTarget = null, departureTrigger = null;
  const likedButtons = new WeakSet();
  const selectedTabs = new WeakMap();
  const switchHomes = new WeakMap();
  const normalizeUser = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
  const dateKeys = ['registered_at','registration_date','joined_at','created_at','date_joined'];
  function registration(profile) {
    for (const key of dateKeys) {
      const value = profile?.[key];
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value)) continue;
      const date = new Date(value);
      if (Number.isFinite(+date) && date.getFullYear() >= 2000 && +date <= Date.now()) {
        return new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'long',year:'numeric'}).format(date);
      }
    }
    return null;
  }
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function updateProfile(prefix) {
    const username = document.getElementById(prefix + 'User');
    const name = document.getElementById(prefix + 'Name');
    if (!username || !name) return;
    const key = normalizeUser(username.textContent);
    const data = profiles.get(key);
    let meta = username.parentElement.querySelector(':scope > .gp-registration');
    if (!settings.enabled || !settings.showRegDate || !key || key === '—') { meta?.remove(); return; }
    if (!meta) { meta = document.createElement('div'); meta.className = 'gp-registration'; username.after(meta); }
    const date = registration(data);
    const evidence=settings.estimateDates && data?.activity_at && registration({created_at:data.activity_at});
    setText(meta,date?'На платформе с '+date:evidence?'Создан примерно '+evidence:'Недостаточно данных для оценки даты');
    meta.title=date?'Точная дата из профиля GhostSocial.':evidence?'Самая ранняя найденная активность ('+(data.activity_source||'публикации')+'). Регистрация могла быть раньше.':'Откройте старые публикации или комментарии: найденная активность позволит оценить верхнюю границу даты регистрации.';
  }
  function refresh() {
    scheduled = false;
    // The site appends this toolbar to body. Keep its native buttons and listeners,
    // but put it in the same column as the filters and restore it when disabled.
    const feedSwitch = document.getElementById('feedSwitch');
    const header = document.getElementById('appHeader');
    if (feedSwitch && header) {
      if (settings.enabled && !header.contains(feedSwitch)) {
        let home = switchHomes.get(feedSwitch);
        if (!home?.isConnected) {
          home = document.createComment('GhostPLUS toolbar position');
          feedSwitch.before(home); switchHomes.set(feedSwitch, home);
        }
        header.append(feedSwitch);
      } else if (!settings.enabled) {
        const home = switchHomes.get(feedSwitch);
        if (home?.isConnected) { home.replaceWith(feedSwitch); switchHomes.delete(feedSwitch); }
      }
    }
    const main = document.getElementById('appMain');
    root.classList.toggle('gp-app-ready', !!main && getComputedStyle(main).display !== 'none');
    updateProfile('prof'); updateProfile('fp');
    // The native feed does not consistently update both navigation groups.
    const active = document.querySelector('#appMain > .screen.active');
    if (active && active.id !== currentScreen) {
      if (currentScreen && currentScreen !== 'screenCreate') previousScreen = currentScreen;
      currentScreen = active.id;
    }
    if (settings.enabled && active) document.querySelectorAll('#dtSideLeft [data-screen]').forEach(nav => {
      const selected = nav.dataset.screen === active.id;
      if (nav.classList.contains('active') !== selected) nav.classList.toggle('active', selected);
      if (selected && nav.getAttribute('aria-current') !== 'page') nav.setAttribute('aria-current','page');
      if (!selected && nav.hasAttribute('aria-current')) nav.removeAttribute('aria-current');
    });
    measureHeader();
    if (settings.enabled) {
      ensureComposerBack();
      const menu=document.querySelector('#gsMenuPanel .gsm-page');
      if(menu?.querySelector('.gsm-head') && !menu.querySelector('.gp-view-profile')) {
        const button=document.createElement('button');button.type='button';button.className='gp-view-profile';button.textContent='Посмотреть профиль';
        button.addEventListener('click',()=>{document.getElementById('gsMenuPanel')?.classList.remove('open');document.getElementById('gsMenuOverlay')?.classList.remove('open');navigate('screenProfile');});
        menu.querySelector('.gsm-head').append(button);
      }
      const profileBody=document.querySelector('#screenProfile .gs-profile-body');
      if(profileBody && !profileBody.querySelector('.gp-status-suggestion')) {
        const suggest=document.createElement('button');suggest.type='button';suggest.className='gp-status-suggestion';suggest.textContent='Что у вас нового? Добавить или изменить статус';
        suggest.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('ghostplus:command',{detail:JSON.stringify({type:'edit-status'})})));
        profileBody.append(suggest);
      }
      const statusModal=document.getElementById('dailyStatusModal');
      if(statusModal && !statusModal.querySelector('.gp-status-cancel')) {
        const description=statusModal.querySelector('p');if(description)description.textContent='Короткий статус виден в вашем профиле. Обновляйте его, когда захотите. Срок хранения задаёт платформа.';
        const cancel=document.createElement('button');cancel.type='button';cancel.className='gp-status-cancel';cancel.textContent='Позже';cancel.addEventListener('click',()=>statusModal.remove());statusModal.firstElementChild?.append(cancel);
      }
      document.querySelectorAll('.gs-profile-tabs .prof-tab').forEach(tab => {
        if (tab.querySelector('.gp-tab-label')) return;
        const label = tab.getAttribute('aria-label') || tab.title;
        if (!label) return;
        const text=document.createElement('span');text.className='gp-tab-label';text.textContent=label;tab.append(text);
      });
      document.querySelectorAll('#headerFilters,.gs-profile-tabs').forEach(strip => {
        const tabs=strip.querySelectorAll('button');
        tabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab.classList.contains('active'))));
        const selected=strip.querySelector('button.active');
        if (!selected || selectedTabs.get(strip)===selected || !strip.getBoundingClientRect().height) return;
        selectedTabs.set(strip,selected);
        const a=selected.getBoundingClientRect(),b=strip.getBoundingClientRect();
        const delta=a.left<b.left?a.left-b.left:a.right>b.right?a.right-b.right:0;
        if (delta) strip.scrollBy({left:delta,behavior:settings.animations && !matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'});
      });
      document.querySelectorAll('[data-action="react-toggle"], .msk-react-btn, .com-react').forEach(button => {
        const liked = button.classList.contains('liked') || button.classList.contains('on');
        if (liked && !likedButtons.has(button)) {
          likedButtons.add(button);
          // Animate only the icon: counters, popovers and the post keep their position.
          const icon = button.querySelector('i,svg');
          if (icon && settings.animations && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            icon.animate([{transform:'scale(1)'},{transform:'scale(1.22)',offset:.4},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});
          }
        } else if (!liked) likedButtons.delete(button);
      });
    }
    GhostPlusNotifications.refresh();
  }
  function measureHeader() {
    const header = document.getElementById('appHeader');
    if (!header) return;
    const space = Math.ceil(header.getBoundingClientRect().height) + 'px';
    if (root.style.getPropertyValue('--gp-header-space') !== space) root.style.setProperty('--gp-header-space', space);
  }
  function ensureComposerBack() {
    const targets = [document.querySelector('#screenCreate .gs-v2-screen-heading'),document.getElementById('mskCompose')];
    for (const target of targets) {
      if (!target || target.querySelector(':scope > .gp-create-back')) continue;
      const back = document.createElement('button'); back.type='button'; back.className='gp-create-back';
      back.textContent='← Назад'; back.setAttribute('aria-label','Вернуться из создания публикации');
      back.addEventListener('click', () => navigate(previousScreen === 'screenCreate' ? 'screenFeed' : previousScreen));
      target.prepend(back);
    }
    const panel = document.getElementById('mskcPostPanel');
    if (panel && !panel.querySelector('.gp-composer-title')) {
      const title=document.createElement('h1');title.className='gp-composer-title';title.textContent='Новая публикация';panel.prepend(title);
    }
  }
  function confirmDeparture(url, trigger, newTab) {
    departureTarget={url:url.href,newTab}; departureTrigger=trigger;
    if (!departureDialog) {
      departureDialog=document.createElement('dialog');departureDialog.className='gp-departure';
      departureDialog.setAttribute('aria-labelledby','gp-departure-title');
      const title=document.createElement('h2');title.id='gp-departure-title';
      const text=document.createElement('p');text.textContent='Откроется другая страница GhostEcos. Хотите перейти?';
      const actions=document.createElement('div');actions.className='gp-dialog-actions';
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Остаться';cancel.autofocus=true;
      const proceed=document.createElement('button');proceed.type='button';proceed.textContent='Перейти';proceed.className='gp-confirm';
      cancel.addEventListener('click',()=>departureDialog.close());
      proceed.addEventListener('click',()=>{
        const target=departureTarget;departureDialog.close();
        if (target?.newTab) window.open(target.url,'_blank','noopener,noreferrer');
        else if (target) location.assign(target.url);
      });
      departureDialog.addEventListener('close',()=>{departureTarget=null;departureTrigger?.focus();});
      actions.append(cancel,proceed);departureDialog.append(title,text,actions);document.body.append(departureDialog);
    }
    departureDialog.querySelector('h2').textContent='Перейти в '+(url.pathname.startsWith('/bank')?'GhostBank':'GhostChat')+'?';
    if (!departureDialog.open) departureDialog.showModal();
  }
  function interceptDeparture(event) {
    if (!settings.enabled || event.defaultPrevented || (event.type==='auxclick' && event.button!==1)) return;
    const link=event.target.closest?.('a[href]');if (!link) return;
    let url;try {url=new URL(link.href,location.href);}catch (_) {return;}
    if (url.origin!==location.origin || !/^\/(bank|chat)(\/|$)/.test(url.pathname)) return;
    event.preventDefault();event.stopImmediatePropagation();
    confirmDeparture(url,link,event.ctrlKey || event.metaKey || event.shiftKey || event.button===1 || link.target==='_blank');
  }
  document.addEventListener('click',interceptDeparture,true);
  document.addEventListener('auxclick',interceptDeparture,true);
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); } }
  window.addEventListener('ghostplus:profile', event => {
    try {
      if (typeof event.detail !== 'string' || event.detail.length > 4096) return;
      const incoming = JSON.parse(event.detail);
      if (!incoming || typeof incoming.username !== 'string' || !/^[\p{L}\p{N}_.-]{1,64}$/u.test(incoming.username)) return;
      const profile = {...profiles.get(normalizeUser(incoming.username)),username:incoming.username};
      for (const key of dateKeys) if (typeof incoming[key] === 'string') profile[key] = incoming[key].slice(0,64);
      if(typeof incoming.activity_at==='string')profile.activity_at=incoming.activity_at.slice(0,64);
      if(typeof incoming.activity_source==='string')profile.activity_source=incoming.activity_source.slice(0,40);
      const key = normalizeUser(profile.username);
      if (profiles.size >= 200 && !profiles.has(key)) profiles.delete(profiles.keys().next().value);
      profiles.set(key, profile); schedule();
    } catch (_) { /* Page events are untrusted. Never interpret markup or code. */ }
  });
  function apply() {
    root.classList.toggle('gp-enabled', settings.enabled);
    root.classList.toggle('gp-live-notifications',settings.enabled && settings.liveNotifications);
    for (const [cls, value] of Object.entries({'gp-desktop':settings.desktopLayout,'gp-motion':settings.animations,
      'gp-glass':settings.glass})) root.classList.toggle(cls, settings.enabled && value);
    root.dataset.gpAccent = settings.accent; root.dataset.gpWidth = settings.width; schedule();
    window.dispatchEvent(new CustomEvent('ghostplus:command',{detail:JSON.stringify({type:'settings',enabled:settings.enabled,notifications:settings.liveNotifications,estimate:settings.estimateDates})}));
    GhostPlusNotifications.apply(settings.enabled && settings.liveNotifications,settings);
    if (!settings.enabled) departureDialog?.close();
  }
  function navigate(screen) {
    const nav = document.querySelector('#appNav [data-screen="' + screen + '"]');
    const main = document.getElementById('appMain');
    if(!main || getComputedStyle(main).display==='none')return;
    window.dispatchEvent(new CustomEvent('ghostplus:command',{detail:JSON.stringify({type:'navigate',screen})}));
    if(document.querySelector('#appMain > .screen.active')?.id!==screen && nav)nav.click();
    if(screen!=='screenCreate')window.scrollTo({top:0,behavior:'instant'});
  }
  function mount() {
    const sidebar = document.getElementById('dtSideLeft');
    const paths = {
      screenFeed:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
      screenMinisky:'M4 4h16v16H4z M10 8l6 4-6 4Z',
      screenSearch:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
      screenNotif:'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10 M10 21h4',
      screenProfile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
      bank:'M3 6h18v15H3z M3 6V3h15 M16 11h5v5h-5z',
      chat:'M21 11a9 9 0 0 1-9 9H3l2-4a9 9 0 1 1 16-5 M8 11h8'
    };
    sidebar?.querySelectorAll('.dt-nav-btn').forEach(nav => {
      const path = paths[nav.dataset.screen] || paths[nav.getAttribute('href')?.includes('/bank') ? 'bank' : 'chat'];
      if (!path) return;
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('gp-nav-icon'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
      const line = document.createElementNS('http://www.w3.org/2000/svg','path'); line.setAttribute('d',path); svg.append(line); nav.prepend(svg);
    });
    const observer = new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('.gp-registration'))) schedule();
    });
    observer.observe(document.body, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-username','class','style']});
    const header=document.getElementById('appHeader');
    if (header) new ResizeObserver(measureHeader).observe(header);
    apply();
  }
  document.addEventListener('keydown', event => {
    if (!settings.enabled || !settings.hotkeys || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.target.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return;
    if (document.querySelector('[aria-modal="true"].open, .modal-overlay.active, .modal-overlay.open, .viewer-overlay.open, #gsMenuPanel.open, .gp-departure[open], #mskCompose.show')) return;
    if (event.code === 'KeyN') { event.preventDefault(); navigate('screenCreate'); document.getElementById('postText')?.focus(); }
    if (event.code === 'KeyF') { event.preventDefault(); navigate('screenSearch'); document.getElementById('searchInput')?.focus(); }
  });
  chrome.storage.local.get('settings').then(data => { settings = normalize(data.settings); apply(); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) { settings = normalize(changes.settings.newValue); apply(); }
  });
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})();
