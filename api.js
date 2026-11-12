/**
 * Anil Plastics API Adapter (v08.0)
 * All backend calls are isolated here so Google Apps Script can be swapped
 * for Supabase or another REST backend without touching any UI screen.
 */
window.AnilApi = (function () {
  const DEFAULT_URL = ''; // Intentionally empty in distributed files; set in Setup or Login screen

  function getConfig() {
    return {
      url: localStorage.getItem('ap_webhook_url') || '',
      token: localStorage.getItem('ap_user_token') || '',
      user: JSON.parse(localStorage.getItem('ap_user_profile') || 'null')
    };
  }

  function setUrl(url) {
    localStorage.setItem('ap_webhook_url', String(url || '').trim());
  }

  function setSession(userObj) {
    if (!userObj) {
      localStorage.removeItem('ap_user_token');
      localStorage.removeItem('ap_user_profile');
      return;
    }
    localStorage.setItem('ap_user_token', userObj.token || '');
    localStorage.setItem('ap_user_profile', JSON.stringify(userObj));
  }

  async function post(action, payload) {
    const cfg = getConfig();
    if (!cfg.url) throw new Error('Server URL not configured. Open Setup or Sign-In settings.');
    const body = Object.assign({}, payload || {}, { action });
    if (cfg.token && !body.token) body.token = cfg.token;

    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight on Apps Script
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid server response: ' + text.slice(0, 120));
    }
    if (data && data.authError) {
      window.dispatchEvent(new CustomEvent('ap:auth-expired', { detail: data.message }));
    }
    return data;
  }

  return {
    getConfig,
    setUrl,
    setSession,
    login: (name, pin) => post('login', { name, pin }),
    info: () => post('info', {}),
    fetchStockFeed: (version) => post('stockFeed', { version: version || '' }),
    syncOrders: (salesmanName, orders) => post('syncOrders', { salesmanName, orders }),
    myOrders: (ids, from) => post('myOrders', { ids: ids || [], from: from || '' }),
    myTasks: () => post('myTasks', {}),
    taskStart: (orderId) => post('taskStart', { orderId }),
    taskItemResult: (orderId, itemNo, resultStatus, fulfilledQty, reason) =>
      post('taskItemResult', { orderId, itemNo, resultStatus, fulfilledQty, reason }),
    taskComplete: (orderId, items) => post('taskComplete', { orderId, items })
  };
})();
