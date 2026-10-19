globalThis.GhostPlusSettings = (() => {
  'use strict';
  const defaults = Object.freeze({enabled:true, desktopLayout:true, animations:true, glass:true,
    showRegDate:true, estimateDates:true, liveNotifications:true, notificationSound:true, windowsNotifications:true, hotkeys:true, width:'comfortable', accent:'violet'});
  function normalize(raw = {}) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const settings = {...defaults};
    for (const key of Object.keys(defaults)) {
      if (typeof defaults[key] === 'boolean' && typeof raw[key] === 'boolean') settings[key] = raw[key];
    }
    if (['compact','comfortable','wide'].includes(raw.width)) settings.width = raw.width;
    if (['violet','mint','rose','blue'].includes(raw.accent)) settings.accent = raw.accent;
    return settings;
  }
  return {defaults, normalize};
})();
