/* IndexedDB shramba za obroke — slike se hranijo kot Blob (ne base64), da baza ostane majhna.
   Izpostavi window.DB. */
(function () {
  var DB_NAME = "zdrav-db";
  var STORE = "obroki";
  var VERSION = 1;
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("category", "category", { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode) {
    return open().then(function (db) { return db.transaction(STORE, mode).objectStore(STORE); });
  }

  function add(record) {
    return tx("readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.add(record);
        req.onsuccess = function () { resolve(record.id); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getAll(category) {
    return tx("readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var idx = store.index("category");
        var req = idx.openCursor(IDBKeyRange.only(category));
        req.onsuccess = function () {
          var cur = req.result;
          if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function remove(id) {
    return tx("readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(id);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  window.DB = { add: add, getAll: getAll, remove: remove };
})();
