/* Local notification UI. Navigation and read markers are executed by the
 * platform adapter; no tokens or remote services are used here. */
globalThis.GhostPlusNotifications=(()=>{
  'use strict';
  let enabled=true, mounted=false, count=0, error='', list=[], tray, itemsBox, title, readAll;
  const rows=new Map(), shown=new Set();let ready=false;
  let options={notificationSound:true,windowsNotifications:true},audioContext;
  document.addEventListener('pointerdown',()=>{
    try{audioContext=new AudioContext();void audioContext.resume().catch(()=>{});}catch(_){}
  },{once:true,capture:true});
  function chime(){
    if(!enabled||!options.notificationSound||audioContext?.state!=='running')return;
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
    oscillator.type='sine';oscillator.frequency.setValueAtTime(660,now);oscillator.frequency.setValueAtTime(880,now+.1);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.09,now+.02);gain.gain.exponentialRampToValueAtTime(.001,now+.25);
    oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+.26);
  }
  function announce(item){
    if(options.windowsNotifications)chrome.runtime.sendMessage({type:'GHOSTPLUS_NOTICE',item}).then(result=>{if(!result?.shown&&!result?.duplicate)chime();}).catch(chime);
    else chime();
  }
  const command=(type,extra={})=>window.dispatchEvent(new CustomEvent('ghostplus:command',{detail:JSON.stringify({type,...extra})}));
  function node(tag,text,cls) {const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
  function mount() {
    if(mounted || !document.body || !document.getElementById('screenNotif'))return;mounted=true;
    tray=node('aside',null,'gp-notifications');tray.setAttribute('aria-label','Непрочитанные уведомления');
    const header=node('div',null,'gp-notifications-head');title=node('strong','Уведомления');
    const hide=node('button','Свернуть');hide.type='button';hide.setAttribute('aria-expanded','true');
    hide.addEventListener('click',()=>{const collapsed=tray.classList.toggle('gp-collapsed');hide.textContent=collapsed?'Развернуть':'Свернуть';hide.setAttribute('aria-expanded',String(!collapsed));});
    header.append(title,hide);itemsBox=node('div',null,'gp-notification-items');
    const footer=node('div',null,'gp-notifications-footer');readAll=node('button','Прочитать все');readAll.type='button';
    readAll.addEventListener('click',()=>{readAll.disabled=true;command('read-all');});
    const all=node('button','Все уведомления');all.type='button';all.addEventListener('click',()=>document.getElementById('navNotif')?.click());
    footer.append(all,readAll);tray.append(header,itemsBox,footer);document.body.append(tray);
    const screen=document.getElementById('screenNotif');
    if(screen) {
      const toolbar=node('div',null,'gp-notifications-toolbar');const button=node('button','Прочитать все');button.type='button';
      button.addEventListener('click',()=>command('read-all'));toolbar.append(button);screen.prepend(toolbar);
    }
    document.addEventListener('click',event=>{
      const card=event.target.closest?.('#notifList .notif-card[data-gp-notice-id]');
      if(enabled&&card)command('read-notification',{id:Number(card.dataset.gpNoticeId)});
    },true);
  }
  function render() {
    mount();if(!tray)return;
    const active=!!document.getElementById('appMain') && getComputedStyle(document.getElementById('appMain')).display!=='none';
    tray.hidden=!enabled || !active || (count===0 && !error);
    if(title.textContent!=='Уведомления · '+count)title.textContent='Уведомления · '+count;
    const unread=list.filter(n=>!n.is_read).sort((a,b)=>b.id-a.id);
    const signature=JSON.stringify([unread.slice(0,4),error,count]);
    if(itemsBox.dataset.signature!==signature) {
      itemsBox.dataset.signature=signature;itemsBox.replaceChildren();
      if(error){itemsBox.append(node('p',error,'gp-notification-error'));const retry=node('button','Повторить');retry.type='button';retry.addEventListener('click',()=>command('refresh-notifications'));itemsBox.append(retry);}
      else if(!unread.length && count>0)itemsBox.append(node('p','Получаем новые уведомления…'));
      for(const n of unread.slice(0,4)) {
        const button=node('button',null,'gp-notification-item');button.type='button';
        const descriptions={comment:'оставил комментарий',comment_react:'отреагировал на комментарий',react:'отреагировал на пост',like:'оценил пост',mention:'упомянул вас',follow:'подписался на вас',new_post:'опубликовал пост'};
        button.append(node('strong',n.actor_name),node('span',descriptions[n.type]||'Новое уведомление'));
        if(n.preview && !['react','comment_react'].includes(n.type))button.append(node('small',n.preview));
        button.addEventListener('click',()=>command('open-notification',{id:n.id}));itemsBox.append(button);
      }
    }
    readAll.disabled=count===0;
    const nav=document.querySelector('#dtSideLeft [data-screen="screenNotif"]');
    if(nav) {
      let badge=nav.querySelector('.gp-notif-count');
      if(!badge){badge=node('span',null,'gp-notif-count');nav.append(badge);}
      badge.hidden=!enabled||count===0;const text=count>99?'99+':String(count);if(badge.textContent!==text)badge.textContent=text;
      nav.setAttribute('aria-label','Уведомления: '+count+' непрочитанных');
    }
    document.querySelectorAll('#notifList .notif-card').forEach((card,index)=>{
      const item=list.find(n=>n.id===rows.get(index));if(!item)return;
      card.dataset.gpNoticeId=String(item.id);
      const unread=enabled && !item.is_read;
      if(card.classList.contains('gp-unread')!==unread)card.classList.toggle('gp-unread',unread);
      if(item.is_read && card.classList.contains('unread'))card.classList.remove('unread');
    });
  }
  window.addEventListener('ghostplus:notifications',event=>{
    try {
      if(typeof event.detail!=='string'||event.detail.length>160000)return;
      const data=JSON.parse(event.detail);if(!Array.isArray(data.items)||data.items.length>150)return;
      count=Number.isFinite(data.count)?Math.max(0,Math.floor(data.count)):0;error=typeof data.error==='string'?data.error.slice(0,200):'';
      list=data.items.filter(n=>Number.isSafeInteger(n.id)&&typeof n.actor_name==='string').map(n=>({...n,actor_name:n.actor_name.slice(0,100),preview:String(n.preview||'').slice(0,240)}));
      if(data.reset){rows.clear();shown.clear();ready=false;}
      if(Array.isArray(data.page)) {if(data.offset===0)rows.clear();data.page.forEach((id,i)=>rows.set((data.offset||0)+i,id));}
      while(rows.size>500)rows.delete(rows.keys().next().value);
      // Live announcements contain text only, never server HTML.
      const fresh=list.filter(n=>!n.is_read&&!shown.has(n.id));
      list.forEach(n=>shown.add(n.id));while(shown.size>300)shown.delete(shown.values().next().value);
      if(ready&&fresh.length&&enabled) {let status=document.getElementById('gp-notif-status');if(!status){status=node('div',null,'gp-sr-only');status.id='gp-notif-status';status.setAttribute('role','status');document.body.append(status);}status.textContent='Новых уведомлений: '+fresh.length;announce(fresh.sort((a,b)=>b.id-a.id)[0]);}
      if(Array.isArray(data.page)||count===0)ready=true;render();
    }catch(_){/* Ignore malformed page events. */}
  });
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==='GHOSTPLUS_OPEN_NOTICE'&&Number.isSafeInteger(message.id))command('open-notification',{id:message.id});});
  return {apply(value,settings){enabled=value;if(settings)options=settings;render();},refresh:render};
})();
