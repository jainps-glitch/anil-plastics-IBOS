/**
 * Anil Plastics IndexedDB Storage Engine + One-Time localStorage Migration
 * Stores ~10,000+ items, orders, tasks, offline task queue, and PDF blobs safely.
 */
window.AnilDB = (function () {
  const DB_NAME = 'AnilPlasticsDB_v8';
  const DB_VER = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: '_key' });
        if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'orderId' });
        if (!db.objectStoreNames.contains('taskQueue')) db.createObjectStore('taskQueue', { keyPath: 'qid', autoIncrement: true });
        if (!db.objectStoreNames.contains('pdfs')) db.createObjectStore('pdfs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const res = fn(s);
      t.oncomplete = () => resolve(res && res.result !== undefined ? res.result : res);
      t.onerror = () => reject(t.error);
    });
  }

  async function getAll(store) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function putMany(store, arr, clearFirst) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      if (clearFirst) s.clear();
      for (const item of arr) s.put(item);
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  async function putOne(store, obj) {
    return tx(store, 'readwrite', (s) => s.put(obj));
  }

  async function deleteOne(store, key) {
    return tx(store, 'readwrite', (s) => s.delete(key));
  }

  async function clearAll() {
    const db = await open();
    const stores = ['items', 'orders', 'tasks', 'taskQueue', 'meta'];
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, 'readwrite');
      stores.forEach((st) => t.objectStore(st).clear());
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  function makeItemKey(it) {
    const bc = String(it.Barcode || '').trim();
    const nm = String(it.ItemName || '').trim().toLowerCase();
    return bc ? (bc + '::' + nm) : ('NO_BC::' + nm);
  }

  // Migrate any legacy Ver 05/06 localStorage items & orders so zero data is lost
  async function migrateFromLegacyLocalStorage() {
    const done = localStorage.getItem('ap_idb_migrated_v8');
    if (done) return;

    const itemKeys = ['ap_items_v6', 'ap_items', 'anil_items', 'masterItems'];
    const orderKeys = ['ap_orders_v6', 'ap_orders', 'anil_orders', 'savedOrders'];

    for (const k of itemKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            const norm = parsed.map((it) => Object.assign({}, it, { _key: makeItemKey(it) }));
            await putMany('items', norm, false);
          }
        } catch (e) {}
      }
    }

    for (const k of orderKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            const norm = parsed.map((o) => Object.assign({ status: o.synced ? 'Synced' : 'New' }, o));
            await putMany('orders', norm, false);
          }
        } catch (e) {}
      }
    }

    // Carry over legacy webhook URL if present
    const oldUrl = localStorage.getItem('ap_webhook_v6') || localStorage.getItem('webhookUrl');
    if (oldUrl && !localStorage.getItem('ap_webhook_url')) {
      localStorage.setItem('ap_webhook_url', oldUrl);
    }

    localStorage.setItem('ap_idb_migrated_v8', '1');
  }

  return {
    open, getAll, putMany, putOne, deleteOne, clearAll, makeItemKey, migrateFromLegacyLocalStorage
  };
})();
