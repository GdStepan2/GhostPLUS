(() => {
  'use strict';
  const {normalize, defaults} = GhostPlusSettings;
  let current, pending = Promise.resolve();
  const status = document.getElementById('status');
  function render() {
    document.querySelectorAll('[data-setting]').forEach(input => {
      if (input.type === 'checkbox') input.checked = current[input.dataset.setting];
      else input.value = current[input.dataset.setting];
    });
    document.querySelectorAll('[data-accent]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.accent === current.accent)));
  }
  function save(patch) {
    current = normalize({...current, ...patch}); render();
    const snapshot = {...current};
    pending = pending.catch(() => {}).then(() => chrome.storage.local.set({settings:snapshot})).then(() => {
      status.textContent = 'Сохранено';
    }).catch(() => { status.textContent = 'Не удалось сохранить настройки'; });
  }
  document.querySelectorAll('input,select,button').forEach(node => node.disabled = true);
  chrome.storage.local.get('settings').then(data => {
    current = normalize(data.settings); render();
    document.querySelectorAll('input,select,button').forEach(node => node.disabled = false);
    document.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('change', () => {
      save({[input.dataset.setting]:input.type === 'checkbox' ? input.checked : input.value});
    }));
    document.querySelectorAll('[data-accent]').forEach(button => button.addEventListener('click', () => save({accent:button.dataset.accent})));
    document.getElementById('reset').addEventListener('click', () => save(defaults));
  }).catch(() => { status.textContent = 'Не удалось загрузить настройки'; });
})();
