{
  "manifest_version": 3,
  "name": "GhostPLUS — оформление GhostSocial",
  "short_name": "GhostPLUS",
  "version": "1.0.0",
  "minimum_chrome_version": "116",
  "description": "Новый дизайн GhostSocial для ПК: темы, плавные анимации, удобная навигация и дополнительные сведения в профилях.",
  "permissions": ["storage","notifications"],
  "background": {"service_worker":"background/background.js"},
  "icons": {"16":"icons/icon16.png","32":"icons/icon32.png","48":"icons/icon48.png","128":"icons/icon128.png"},
  "action": {"default_popup":"popup/popup.html","default_title":"GhostPLUS","default_icon":{"16":"icons/icon16.png","32":"icons/icon32.png","48":"icons/icon48.png","128":"icons/icon128.png"}},
  "content_scripts": [
    {"matches":["https://ghostecos.duckdns.org/v2/social","https://ghostecos.duckdns.org/v2/social/*"],"js":["content/bridge.js"],"world":"MAIN","run_at":"document_start"},
    {"matches":["https://ghostecos.duckdns.org/v2/social","https://ghostecos.duckdns.org/v2/social/*"],"css":["content/styles.css","content/badges.css"],"js":["shared/settings.js","content/notifications.js","content/content.js"],"run_at":"document_start"},
    {"matches":["https://ghostecos.duckdns.org/chat/*"],"css":["content/badges.css"],"js":["content/chat.js"],"run_at":"document_start"}
  ]
}
