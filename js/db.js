/* Zdrav — podatkovni sloj.
   Vir resnice: Supabase (tabela `jedi` + Storage bucket `jedi-slike`).
   IndexedDB (`zdrav-cache`) je SAMO bralni predpomnilnik zadnjega stanja, da
   aplikacija brez povezave prikaze zadnje znane jedi. Dodajanje, urejanje in
   brisanje potrebujejo internetno povezavo.
   Izpostavi window.sb (Supabase klient) in window.DB (operacije nad jedmi). */
(function () {
  var CFG = window.SUPABASE_CONFIG || {};
  var sb = window.supabase.createClient(CFG.url, CFG.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "zdrav-auth" }
  });
  window.sb = sb;

  var BUCKET = "jedi-slike";

  // ------------------------------------------------ IndexedDB bralni predpomnilnik
  var DB_NAME = "zdrav-cache";
  var DB_VERSION = 1;
  var META = "jedi_meta";   // surove vrstice iz tabele `jedi` (brez slik)
  var IMG = "jedi_slike";   // { pot: string, blob: Blob }
  var dbPromise = null;

  function idb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(META)) {
          var s = db.createObjectStore(META, { keyPath: "id" });
          s.createIndex("kategorija", "kategorija", { unique: false });
        }
        if (!db.objectStoreNames.contains(IMG)) {
          db.createObjectStore(IMG, { keyPath: "pot" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function store(name, mode) {
    return idb().then(function (db) { return db.transaction(name, mode).objectStore(name); });
  }
  function reqP(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function cacheGetCategory(kategorija) {
    return store(META, "readonly")
      .then(function (s) { return reqP(s.index("kategorija").getAll(IDBKeyRange.only(kategorija))); })
      .catch(function () { return []; });
  }
  function cacheReplaceCategory(kategorija, rows) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(META, "readwrite");
        var s = tx.objectStore(META);
        s.index("kategorija").openCursor(IDBKeyRange.only(kategorija)).onsuccess = function (e) {
          var cur = e.target.result;
          if (cur) { cur.delete(); cur.continue(); }
        };
        rows.forEach(function (r) { s.put(r); });
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { res(); };
      });
    }).catch(function () {});
  }
  function cachePutRow(row) {
    return store(META, "readwrite").then(function (s) { return reqP(s.put(row)); }).catch(function () {});
  }
  function cacheDeleteRow(id) {
    return store(META, "readwrite").then(function (s) { return reqP(s.delete(id)); }).catch(function () {});
  }
  function imgGet(pot) {
    return store(IMG, "readonly").then(function (s) { return reqP(s.get(pot)); })
      .then(function (row) { return row ? row.blob : null; })
      .catch(function () { return null; });
  }
  function imgPut(pot, blob) {
    return store(IMG, "readwrite").then(function (s) { return reqP(s.put({ pot: pot, blob: blob })); })
      .catch(function () {});
  }
  function imgDelete(pot) {
    return store(IMG, "readwrite").then(function (s) { return reqP(s.delete(pot)); }).catch(function () {});
  }

  function clearCache() {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction([META, IMG], "readwrite");
        tx.objectStore(META).clear();
        tx.objectStore(IMG).clear();
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { res(); };
      });
    }).catch(function () {});
  }

  // ----------------------------------------------------------------- pomozne
  function currentUserId() {
    return sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s || !s.user) throw new Error("Ni prijavljenega uporabnika.");
      return s.user.id;
    });
  }

  function rowToMeal(row, imageBlob) {
    return {
      id: row.id,
      category: row.kategorija,
      name: row.ime,
      ingredients: row.sestavine || "",
      image: imageBlob || null,
      imagePath: row.slika_pot || null,
      created: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  function downloadImage(pot) {
    if (!pot) return Promise.resolve(null);
    return sb.storage.from(BUCKET).download(pot).then(function (res) {
      if (res.error || !res.data) throw (res.error || new Error("ni slike"));
      imgPut(pot, res.data);
      return res.data;
    }).catch(function () { return imgGet(pot); });
  }

  function uploadImage(pot, blob) {
    return sb.storage.from(BUCKET).upload(pot, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg"
    }).then(function (res) {
      if (res.error) throw res.error;
      imgPut(pot, blob);
      return pot;
    });
  }

  function removeImage(pot) {
    if (!pot) return Promise.resolve();
    return sb.storage.from(BUCKET).remove([pot]).catch(function () {}).then(function () { imgDelete(pot); });
  }

  // ----------------------------------------------------------------- operacije
  function getAll(kategorija) {
    return sb.from("jedi").select("*")
      .eq("kategorija", kategorija)
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        var rows = res.data || [];
        cacheReplaceCategory(kategorija, rows);
        return Promise.all(rows.map(function (row) {
          return downloadImage(row.slika_pot).then(function (blob) { return rowToMeal(row, blob); });
        }));
      })
      .catch(function (err) {
        console.warn("Zdrav: branje s streznika ni uspelo, uporabljam predpomnilnik.", err);
        return cacheGetCategory(kategorija).then(function (rows) {
          rows.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
          return Promise.all(rows.map(function (row) {
            return (row.slika_pot ? imgGet(row.slika_pot) : Promise.resolve(null))
              .then(function (blob) { return rowToMeal(row, blob); });
          }));
        });
      });
  }

  function add(record) {
    return currentUserId().then(function (uid) {
      var slikaPot = null;
      var pre = Promise.resolve();
      if (record.image instanceof Blob) {
        slikaPot = uid + "/" + record.id + ".jpg";
        pre = uploadImage(slikaPot, record.image);
      }
      return pre.then(function () {
        return sb.from("jedi").insert({
          id: record.id,
          user_id: uid,
          kategorija: record.category,
          ime: record.name,
          sestavine: record.ingredients || "",
          slika_pot: slikaPot
        }).select().single();
      }).then(function (res) {
        if (res.error) throw res.error;
        cachePutRow(res.data);
        return res.data.id;
      });
    });
  }

  // record.image:  Blob = nova slika,  undefined = pusti obstojeco,  null = odstrani
  function update(record) {
    return currentUserId().then(function (uid) {
      var patch = {
        kategorija: record.category,
        ime: record.name,
        sestavine: record.ingredients || ""
      };
      var pre = Promise.resolve();
      if (record.image instanceof Blob) {
        var pot = record.imagePath || (uid + "/" + record.id + ".jpg");
        pre = uploadImage(pot, record.image).then(function () { patch.slika_pot = pot; });
      } else if (record.image === null && record.imagePath) {
        pre = removeImage(record.imagePath).then(function () { patch.slika_pot = null; });
      }
      return pre.then(function () {
        return sb.from("jedi").update(patch).eq("id", record.id).select().single();
      }).then(function (res) {
        if (res.error) throw res.error;
        cachePutRow(res.data);
        return res.data.id;
      });
    });
  }

  function remove(id, imagePath) {
    return removeImage(imagePath).then(function () {
      return sb.from("jedi").delete().eq("id", id);
    }).then(function (res) {
      if (res && res.error) throw res.error;
      cacheDeleteRow(id);
    });
  }

  window.DB = { getAll: getAll, add: add, update: update, remove: remove, clearCache: clearCache };
})();
