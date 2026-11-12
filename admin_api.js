/**
 * Anil Plastics Admin Desktop API Adapter (v08.0)
 * Isolated backend layer so Google Apps Script can be swapped for Supabase later.
 */
window.AnilAdminApi = (function () {
  function getConfig() {
    return {
      url: localStorage.getItem('ap_admin_url') || '',
      token: localStorage.getItem('ap_admin_token') || '',
      user: JSON.parse(localStorage.getItem('ap_admin_user') || 'null')
    };
  }

  function setConfig(url, userObj) {
    if (url !== undefined) localStorage.setItem('ap_admin_url', String(url).trim());
    if (userObj !== undefined) {
      if (!userObj) {
        localStorage.removeItem('ap_admin_token');
        localStorage.removeItem('ap_admin_user');
      } else {
        localStorage.setItem('ap_admin_token', userObj.token || '');
        localStorage.setItem('ap_admin_user', JSON.stringify(userObj));
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
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); }
    catch (e) { throw new Error('Server error: ' + txt.slice(0, 140)); }
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
