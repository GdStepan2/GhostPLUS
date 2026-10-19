importScripts('../shared/settings.js');
const BASE='https://ghostecos.duckdns.org/v2/social';
let noticeQueue=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='GHOSTPLUS_NOTICE')return;
  let url;try{url=new URL(sender.url);}catch(_){return;}
  if(url.origin!=='https://ghostecos.duckdns.org'||!url.pathname.startsWith('/v2/social')||!sender.tab)return;
  const item=message.item;if(!item||!Number.isSafeInteger(item.id)||item.id<=0)return;
  noticeQueue=noticeQueue.catch(()=>{}).then(async()=>{
    const {settings}=await chrome.storage.local.get('settings');const options=GhostPlusSettings.normalize(settings);
    if(!options.enabled||!options.liveNotifications||!options.windowsNotifications){respond({shown:false});return;}
    const data=await chrome.storage.session.get('noticeTargets');const targets=data.noticeTargets||{};const key='ghostplus-'+item.id;
    if(targets[key]){respond({shown:false,duplicate:true});return;}
    targets[key]={tabId:sender.tab.id,postId:Number.isSafeInteger(item.post_id)?item.post_id:0,username:/^[\p{L}\p{N}_.-]{1,64}$/u.test(item.actor_username||'')?item.actor_username:''};
    const keys=Object.keys(targets);while(keys.length>300)delete targets[keys.shift()];
    await chrome.storage.session.set({noticeTargets:targets});
    await chrome.notifications.create(key,{type:'basic',iconUrl:chrome.runtime.getURL('icons/icon128.png'),title:String(item.actor_name||'GhostSocial').slice(0,100),message:String(item.preview||'Новое уведомление GhostSocial').slice(0,240),contextMessage:'GhostPLUS',silent:!options.notificationSound});
    respond({shown:true});
  }).catch(()=>respond({shown:false}));return true;
});
chrome.notifications.onClicked.addListener(async key=>{
  const {noticeTargets={}}=await chrome.storage.session.get('noticeTargets');const target=noticeTargets[key];if(!target)return;
  try {
    const tab=await chrome.tabs.get(target.tabId);await chrome.tabs.update(target.tabId,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
    await chrome.tabs.sendMessage(target.tabId,{type:'GHOSTPLUS_OPEN_NOTICE',id:Number(key.replace('ghostplus-',''))});
  }catch(_){const query=target.postId>0?'?p='+target.postId:target.username?'?u='+encodeURIComponent(target.username):'#screenNotif';await chrome.tabs.create({url:BASE+query});}
  await chrome.notifications.clear(key);
});
