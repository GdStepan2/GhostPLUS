/* Restricted adapter to the platform's own API. Never reads credentials or
 * accepts arbitrary URLs/code from the isolated content script. */
(() => {
  'use strict';
  const original=window.fetch, dates=['registered_at','registration_date','joined_at','created_at','date_joined'];
  let enabled=true, notificationsEnabled=true, estimateEnabled=true, manualRead=false, loading=false, lastLoad=0, count=0, readBusy=false, notificationEpoch=0;
  const activity=new Map(), scanned=new Map(), notifications=new Map();
  const locallyRead=new Set();
  const validUser=s=>typeof s==='string' && /^[\p{L}\p{N}_.-]{1,64}$/u.test(s);
  const emit=(name,data)=>window.dispatchEvent(new CustomEvent('ghostplus:'+name,{detail:JSON.stringify(data)}));
  const apiCall=(path,method='GET')=>typeof window.api==='function'?window.api(path,method):Promise.reject(new Error('API сайта ещё не готов'));
  function timestamp(value) {
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}/.test(value))return null;
    const date=new Date(value);return Number.isFinite(+date) && date.getFullYear()>=2000 && +date<=Date.now()?date.toISOString():null;
  }
  function evidence(username,items,source) {
    if(!validUser(username) || !Array.isArray(items))return;
    const key=username.toLowerCase();let best=activity.get(key);
    for(const item of items.slice(0,100)) {
      if(!item || (item.username && String(item.username).toLowerCase()!==key))continue;
      const date=timestamp(item.created_at);
      if(date && (!best || date<best.activity_at))best={activity_at:date,activity_source:source};
    }
    if(best && best!==activity.get(key)) {
      if(activity.size>=200 && !activity.has(key))activity.delete(activity.keys().next().value);
      activity.set(key,best);emit('profile',{username,...best});
    }
  }
  async function scanOlder(username,offset) {
    if(!estimateEnabled || !enabled || !validUser(username) || scanned.has(username))return;
    if(scanned.size>=100)scanned.delete(scanned.keys().next().value);
    scanned.set(username,true);
    // At most three additional pages per viewed account and tab. Never guesses by ID.
    for(let page=0;page<3 && enabled && estimateEnabled;page++) {
      try {
        const items=await apiCall('/prof/'+encodeURIComponent(username)+'/posts?offset='+offset);
        if(!Array.isArray(items))break;evidence(username,items,'публикации');
        offset+=items.length;if(items.length<15)break;
      }catch(_){break;}
    }
  }
  function profile(data) {
    if(!data || !validUser(data.username))return;
    const out={username:data.username};let exact=false;
    for(const key of dates) {const value=timestamp(data[key]);if(value){out[key]=value;exact=true;}}
    emit('profile',{...out,...activity.get(data.username.toLowerCase())});
    evidence(data.username,data.posts,'публикации');
    if(!exact && data.posts?.length>=15)void scanOlder(data.username,data.posts.length);
  }
  function snapshot(extra={}) {
    const items=[...notifications.values()].slice(0,150);
    const readHere=items.filter(n=>!n.is_read&&locallyRead.has(n.id)).length;
    emit('notifications',{count:Math.max(0,count-readHere),items:items.map(n=>({...n,is_read:n.is_read||locallyRead.has(n.id)})),...extra});
  }
  function readList(data,offset) {
    if(!Array.isArray(data?.notifications))return;
    const page=[];
    for(const n of data.notifications.slice(0,100)) {
      if(!n || !Number.isSafeInteger(Number(n.id)) || Number(n.id)<=0)continue;
      const clean={id:Number(n.id),post_id:Number.isSafeInteger(Number(n.post_id))?Number(n.post_id):0,
        type:String(n.type||'notification').slice(0,40),actor_name:String(n.actor_name||'Участник').slice(0,100),
        actor_username:validUser(n.actor_username)?n.actor_username:'',preview:String(n.preview||'').slice(0,240),
        is_read:n.is_read===true || n.is_read===1,created_at:timestamp(n.created_at)};
      notifications.set(clean.id,clean);page.push(clean.id);
    }
    while(notifications.size>150)notifications.delete(notifications.keys().next().value);
    if(offset===0)count=Math.max(count,page.filter(id=>!notifications.get(id).is_read).length);
    snapshot({page,offset});
  }
  async function loadUnread(force=false) {
    if(!enabled || !notificationsEnabled || loading || (!force && Date.now()-lastLoad<3000))return;
    loading=true;lastLoad=Date.now();
    try {await apiCall('/notif?offset=0');}catch(_){snapshot({error:'Не удалось загрузить уведомления. Повторите попытку.'});}
    finally {loading=false;}
  }
  window.fetch=function(...args) {
    const epoch=notificationEpoch;
    let url,method;
    try {const input=args[0];url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);method=String(args[1]?.method||input?.method||'GET').toUpperCase();}catch(_){}
    const own=url?.origin===location.origin;
    if(own && enabled && notificationsEnabled && url.pathname==='/api/soc/notif/read' && method==='POST' && !manualRead) {
      return Promise.reject(new Error('GhostPLUS: используйте «Прочитать все» для отметки уведомлений.'));
    }
    let result=Reflect.apply(original,this,args);
    if(own && enabled && url.pathname==='/api/soc/status/my') {
      result=result.then(async response=>{
        if(!response.ok)return response;
        try {const data=await response.clone().json();const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');
          return new Response(JSON.stringify({...data,must_set:false}),{status:response.status,statusText:response.statusText,headers});
        }catch(_){return response;}
      });
    }
    if(own && /^\/api\/soc\/(prof\/|com\/get\/|notif(?:\/|$)|logout$)/.test(url.pathname)) {
      result.then(response=>{
        if(!response.ok || !response.headers.get('content-type')?.includes('json'))return;
        response.clone().json().then(data=>{
          if(/^\/api\/soc\/prof\/[^/]+\/?$/.test(url.pathname))profile(data);
          else if(/^\/api\/soc\/prof\/[^/]+\/posts$/.test(url.pathname))evidence(decodeURIComponent(url.pathname.split('/')[4]),data,'публикации');
          else if(url.pathname.startsWith('/api/soc/com/get/')) {
            for(const comment of (Array.isArray(data.comments)?data.comments:[]).slice(0,100))evidence(comment.username,[comment],'комментарии');
          } else if(url.pathname==='/api/soc/notif/unread' && enabled && notificationsEnabled && epoch===notificationEpoch) {
            const previous=count;count=Math.max(0,Math.min(1000000,Number(data.count)||0));if(count===0){if(previous>0)notificationEpoch++;notifications.forEach(n=>n.is_read=true);}snapshot();if(count>0)void loadUnread(count!==previous);
          } else if(url.pathname==='/api/soc/notif' && enabled && notificationsEnabled && epoch===notificationEpoch)readList(data,Math.max(0,Number(url.searchParams.get('offset'))||0));
          else if(url.pathname==='/api/soc/logout') {notificationEpoch++;count=0;notifications.clear();locallyRead.clear();activity.clear();scanned.clear();snapshot({reset:true});}
        }).catch(()=>{});
      }).catch(()=>{});
    }
    return result;
  };
  window.addEventListener('ghostplus:command',async event=>{
    let command;try{if(typeof event.detail!=='string'||event.detail.length>1024)return;command=JSON.parse(event.detail);}catch(_){return;}
    if(command.type==='settings') {enabled=command.enabled===true;notificationsEnabled=command.notifications===true;estimateEnabled=command.estimate!==false;return;}
    if(command.type==='navigate' && enabled) {
      const allowed=['screenFeed','screenSearch','screenCreate','screenProfile','screenFullProfile','screenNotif','screenMinisky'];
      if(allowed.includes(command.screen) && typeof window.switchScreen==='function')window.switchScreen(command.screen);return;
    }
    if(command.type==='edit-status' && enabled) {if(typeof window.openStatusModal==='function')window.openStatusModal();return;}
    if(!enabled || !notificationsEnabled)return;
    if(command.type==='read-all') {
      if(readBusy)return;readBusy=true;
      try {
        manualRead=true;const pending=apiCall('/notif/read','POST');manualRead=false;await pending;
        notificationEpoch++;count=0;notifications.forEach(n=>n.is_read=true);locallyRead.clear();snapshot({readAll:true});
        if(typeof window.updateNotifBadge==='function')window.updateNotifBadge(0);
      }catch(_){snapshot({error:'Не удалось отметить уведомления. Попробуйте ещё раз.'});}
      finally{manualRead=false;readBusy=false;}
    } else if(command.type==='open-notification') {
      const n=notifications.get(Number(command.id));if(!n)return;
      locallyRead.add(n.id);while(locallyRead.size>300)locallyRead.delete(locallyRead.values().next().value);snapshot();
      if(n.type==='follow' && n.actor_username && typeof window.openFullProfile==='function')window.openFullProfile(n.actor_username);
      else if(n.post_id>0 && typeof window.openSinglePost==='function')void window.openSinglePost(n.post_id);
      else if(n.post_id>0 && typeof window.goToPost==='function')window.goToPost(n.post_id);
    } else if(command.type==='read-notification') {
      const n=notifications.get(Number(command.id));if(n){locallyRead.add(n.id);snapshot();}
    } else if(command.type==='refresh-notifications')void loadUnread(true);
  });
})();
