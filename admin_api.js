window.AnilAdminApi = (function () {
  const STORAGE_KEYS = {
    url: 'ap_admin_url',
    token: 'ap_admin_token',
    user: 'ap_admin_user'
  };

  function safeParseJSON(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    try { return JSON.parse(value); }
    catch (e) { return fallback; }
  }

  function getConfig() {
    return {
      url: localStorage.getItem(STORAGE_KEYS.url) || '',
      token: localStorage.getItem(STORAGE_KEYS.token) || '',
      user: safeParseJSON(localStorage.getItem(STORAGE_KEYS.user), null)
    };
  }

  function setConfig(url, userObj) {
    if (url !== undefined) {
      const value = String(url || '').trim();
      if (value) localStorage.setItem(STORAGE_KEYS.url, value);
      else localStorage.removeItem(STORAGE_KEYS.url);
    }

    if (userObj !== undefined) {
      if (!userObj) {
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.user);
      } else {
        localStorage.setItem(STORAGE_KEYS.token, String(userObj.token || '').trim());
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userObj));
      }
    }
  }

  async function post(action, payload) {
    const cfg = getConfig();
    if (!cfg.url) throw new Error('Apps Script /exec URL is not set.');

    const body = Object.assign({}, payload || {}, {
      action,
      token: cfg.token,
      by: cfg.user ? cfg.user.name : 'Office Admin'
    });

    let res;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        cache: 'no-store'
      });
    } catch (error) {
      throw new Error('Network error: ' + (error && error.message ? error.message : 'Unable to reach backend.'));
    }

    const txt = await res.text();
    let data = null;
    try { data = JSON.parse(txt); }
    catch (e) {
      if (!txt) throw new Error('Empty server response.');
      throw new Error('Server error: ' + txt.slice(0, 180));
    }

    if (data && data.authError) {
      window.dispatchEvent(new CustomEvent('ap:admin-auth-expired', { detail: data.message }));
    }

    return data;
  }

  return {
    getConfig,
    setConfig,
    login: (name, pin) => post('login', { name, pin }),
    info: () => post('info', {}),
    dashboardStats: () => post('dashboardStats', {}),
    orders: (params) => post('orders', params || {}),
    orderEvents: (orderId) => post('orderEvents', { orderId }),
    releaseOrder: (orderId, assignedTo, assignedName, priority, dueTime) =>
      post('releaseOrder', { orderId, assignedTo, assignedName, priority, dueTime }),
    reassign: (orderId, assignedTo, assignedName, priority, dueTime) =>
      post('reassign', { orderId, assignedTo, assignedName, priority, dueTime }),
    splitOrder: (orderId, splits) => post('splitOrder', { orderId, splits }),
    cancelOrder: (orderId, reason) => post('cancelOrder', { orderId, reason }),
    setStatus: (ids, status, extra) => post('setStatus', Object.assign({ ids, status }, extra || {})),
    resolveShortage: (orderId, mode) => post('resolveShortage', { orderId, mode }),
    uploadStock: (csv, fileName, itemsCount) => post('uploadStock', { csv, fileName, items: itemsCount, source: 'Desktop Dashboard' }),
    stockFeed: () => post('stockFeed', { version: '' }),
    getUsers: () => post('getUsers', {}),
    saveUser: (userPayload) => post('saveUser', userPayload),
    archiveOld: (days) => post('archiveOld', { days: days || 90 })
  };
})();
