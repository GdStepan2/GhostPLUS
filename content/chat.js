/* Badge placement only; no access to chat messages, requests or credentials. */
(()=>{
  const apply=raw=>document.documentElement.classList.toggle('gp-enabled',raw?.enabled!==false);
  chrome.storage.local.get('settings').then(data=>apply(data.settings)).catch(()=>apply());
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings)apply(changes.settings.newValue);});
})();
