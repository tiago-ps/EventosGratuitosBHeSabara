(() => {
  'use strict';

  const root = window.MuralCultural || (window.MuralCultural = {});
  const DB_NAME = 'mural-cultural-notificacoes-v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'state';
  const PREFS_KEY = 'preferences';
  const FAVORITES_KEY = 'mural-cultural-favoritos-v1';
  const API_ORIGIN = window.location.hostname === 'tiago-ps.github.io'
    ? 'https://temsimuai.com.br'
    : '';

  function apiUrl(path) {
    return `${API_ORIGIN}${path}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('indexeddb_indisponivel'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('indexeddb_erro'));
    });
  }

  async function readState(key, fallback = null) {
    try {
      const db = await openDb();
      return await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result ?? fallback);
        request.onerror = () => resolve(fallback);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return fallback;
    }
  }

  async function writeState(key, value) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('indexeddb_erro'));
      });
      db.close();
      return true;
    } catch {
      return false;
    }
  }

  function localFavorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter(value => typeof value === 'string').slice(0, 1000)
        : [];
    } catch {
      return [];
    }
  }

  async function syncFavorites(favorites = localFavorites()) {
    const current = await readState(PREFS_KEY, {});
    await writeState(PREFS_KEY, {
      ...current,
      favorites: [...new Set((Array.isArray(favorites) ? favorites : []).filter(value => typeof value === 'string'))],
      favoritesOnly: true,
      leadDays: 1,
      updatedAt: new Date().toISOString()
    });
  }

  function base64UrlToUint8Array(value) {
    const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const raw = atob(padded);
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }

  async function notificationConfig() {
    const response = await fetch(apiUrl('/api/notificacoes/config'), {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('servico_indisponivel');
    const config = await response.json();
    if (!config?.disponivel || !config?.public_key) throw new Error('servico_indisponivel');
    return config;
  }

  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function iosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  }

  async function registration() {
    if (!supported()) throw new Error('nao_suportado');
    return navigator.serviceWorker.ready;
  }

  async function currentSubscription() {
    if (!supported()) return null;
    try {
      return await (await registration()).pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  async function postSubscription(endpoint) {
    const response = await fetch(apiUrl('/api/notificacoes'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('assinatura_nao_registrada');
  }

  async function deleteSubscription(endpoint) {
    if (!endpoint) return;
    try {
      await fetch(apiUrl('/api/notificacoes'), {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
        cache: 'no-store'
      });
    } catch {
      // A remoção local ainda é útil; endpoints inválidos também são limpos no servidor.
    }
  }

  async function enableNotifications() {
    if (!supported()) throw new Error('nao_suportado');
    if (iosDevice() && !standalone()) throw new Error('ios_tela_inicio');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error(permission === 'denied' ? 'permissao_negada' : 'permissao_pendente');

    const config = await notificationConfig();
    const reg = await registration();
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(config.public_key)
      });
    }

    await postSubscription(subscription.endpoint);
    await writeState(PREFS_KEY, {
      ...(await readState(PREFS_KEY, {})),
      enabled: true,
      favoritesOnly: true,
      leadDays: 1,
      favorites: localFavorites(),
      updatedAt: new Date().toISOString()
    });
    return subscription;
  }

  async function disableNotifications() {
    const subscription = await currentSubscription();
    if (subscription) {
      await deleteSubscription(subscription.endpoint);
      try { await subscription.unsubscribe(); } catch { /* já pode ter expirado */ }
    }
    await writeState(PREFS_KEY, {
      ...(await readState(PREFS_KEY, {})),
      enabled: false,
      updatedAt: new Date().toISOString()
    });
  }

  function statusMessage(errorCode = '') {
    const messages = {
      nao_suportado: 'Este navegador não oferece notificações Web Push para este site.',
      ios_tela_inicio: 'No iPhone e iPad, adicione o Tem Sim, Uai à Tela de Início e abra por esse ícone para ativar notificações.',
      permissao_negada: 'As notificações estão bloqueadas nas configurações do navegador.',
      permissao_pendente: 'A permissão não foi concedida.',
      servico_indisponivel: 'O serviço de notificações ainda não está disponível neste ambiente.',
      assinatura_nao_registrada: 'Não foi possível registrar este navegador para notificações.'
    };
    return messages[errorCode] || 'Não foi possível alterar as notificações agora.';
  }

  async function openSettings() {
    document.getElementById('mural-notifications-dialog')?.remove();

    const prefs = await readState(PREFS_KEY, {});
    const subscription = await currentSubscription();
    const enabled = Boolean(prefs.enabled && subscription && Notification.permission === 'granted');

    const dialog = document.createElement('dialog');
    dialog.id = 'mural-notifications-dialog';
    dialog.className = 'mural-notifications-dialog';
    dialog.innerHTML = `
      <div class="mural-notifications-card">
        <div class="mural-notifications-heading">
          <div>
            <p class="mural-notifications-eyebrow">Lembretes do Mural</p>
            <h2>Notificações de eventos</h2>
          </div>
          <button type="button" class="mural-notifications-close" aria-label="Fechar">×</button>
        </div>

        <div class="mural-notifications-status ${enabled ? 'is-enabled' : ''}">
          <span aria-hidden="true">${enabled ? '🔔' : '🔕'}</span>
          <div>
            <strong>${enabled ? 'Notificações ativadas' : 'Notificações desativadas'}</strong>
            <span>${enabled ? 'O navegador pode lembrar você dos seus eventos favoritados.' : 'Ative para receber lembretes dos eventos que você favoritar.'}</span>
          </div>
        </div>

        <div class="mural-notifications-rule">
          <strong>Como funciona</strong>
          <span>Um lembrete é exibido 1 dia antes de eventos marcados como favoritos.</span>
        </div>

        <p class="mural-notifications-privacy">
          <strong>Sem cadastro.</strong> Seus favoritos e preferências ficam neste aparelho.
          O servidor guarda somente a assinatura técnica necessária para entregar o sinal de notificação,
          sem nome, e-mail, telefone, localização ou lista de favoritos.
        </p>

        <p class="mural-notifications-feedback" role="status" aria-live="polite"></p>

        <div class="mural-notifications-actions">
          <button type="button" class="mural-notifications-toggle ${enabled ? 'secondary' : ''}">
            ${enabled ? 'Desativar notificações' : 'Ativar notificações'}
          </button>
        </div>
      </div>
    `;
    document.body.append(dialog);

    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    dialog.querySelector('.mural-notifications-close')?.addEventListener('click', close);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });

    const toggle = dialog.querySelector('.mural-notifications-toggle');
    const feedback = dialog.querySelector('.mural-notifications-feedback');
    toggle?.addEventListener('click', async () => {
      toggle.disabled = true;
      feedback.textContent = enabled ? 'Desativando…' : 'Ativando…';
      try {
        if (enabled) await disableNotifications();
        else await enableNotifications();
        close();
        await openSettings();
      } catch (error) {
        feedback.textContent = statusMessage(String(error?.message || error));
        toggle.disabled = false;
      }
    });

    dialog.showModal();
  }

  function headerButtonMarkup() {
    return `<button class="agenda-notifications-button" type="button" title="Notificações de eventos" aria-label="Notificações de eventos"><span aria-hidden="true">🔔</span><span class="agenda-notifications-label">Notificações</span></button>`;
  }

  function bindAgendaHeader(header) {
    header?.querySelector('.agenda-notifications-button')?.addEventListener('click', openSettings);
  }

  root.notifications = Object.freeze({
    syncFavorites,
    openSettings,
    headerButtonMarkup,
    bindAgendaHeader
  });
})();
