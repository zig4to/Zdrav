/* Zdrav — baza zdravih obrokov + naključni izbor, ko zmanjka idej. */

const CATEGORIES = [
  { id: "zajtrk", name: "Zajtrk", emoji: "🌅" },
  { id: "kosilo", name: "Kosilo", emoji: "🍲" },
  { id: "vecerja", name: "Večerja", emoji: "🌙" },
  { id: "malica", name: "Malica", emoji: "🥕" }
];

const MAX_IMG_W = 900;
const JPEG_Q = 0.85;

let activeCategory = CATEGORIES[0].id;
let objectUrls = [];

const tabsEl = document.getElementById("tabs");
const panelTitleEl = document.getElementById("panelTitle");
const mealsGridEl = document.getElementById("mealsGrid");
const addMealBtn = document.getElementById("addMealBtn");
const randomBtn = document.getElementById("randomBtn");

function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id);
}

function revokeObjectUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------- zavihki
function renderTabs() {
  tabsEl.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (cat.id === activeCategory ? " active" : "");
    btn.textContent = cat.emoji + " " + cat.name;
    btn.addEventListener("click", () => {
      activeCategory = cat.id;
      renderTabs();
      renderPanel();
    });
    tabsEl.appendChild(btn);
  });
}

function renderPanel() {
  panelTitleEl.textContent = getCategory(activeCategory).name;
  renderGrid();
}

// ------------------------------------------------------------------ mreža
function renderGrid() {
  revokeObjectUrls();
  mealsGridEl.innerHTML = "";
  DB.getAll(activeCategory).then((meals) => {
    if (!meals.length) {
      const hint = document.createElement("p");
      hint.className = "empty-hint";
      hint.textContent = "Ni še obrokov v tej kategoriji. Dodaj prvega zgoraj.";
      mealsGridEl.appendChild(hint);
      return;
    }

    meals.sort((a, b) => b.created - a.created).forEach((meal) => {
      mealsGridEl.appendChild(buildMealCard(meal));
    });
  });
}

function buildMealCard(meal) {
  const card = document.createElement("div");
  card.className = "meal-card";

  if (meal.image) {
    const url = URL.createObjectURL(meal.image);
    objectUrls.push(url);
    const img = document.createElement("img");
    img.className = "meal-thumb";
    img.src = url;
    img.alt = meal.name;
    card.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "meal-thumb-placeholder";
    ph.textContent = "🍽️";
    card.appendChild(ph);
  }

  const body = document.createElement("div");
  body.className = "meal-body";

  const name = document.createElement("div");
  name.className = "meal-name";
  name.textContent = meal.name;
  body.appendChild(name);

  if (meal.ingredients) {
    const ing = document.createElement("div");
    ing.className = "meal-ingredients";
    ing.textContent = meal.ingredients;
    body.appendChild(ing);
  }

  const actions = document.createElement("div");
  actions.className = "meal-actions";

  const edit = document.createElement("button");
  edit.className = "meal-edit";
  edit.type = "button";
  edit.textContent = "✏️ Uredi";
  edit.addEventListener("click", () => openMealModal(meal));
  actions.appendChild(edit);

  const del = document.createElement("button");
  del.className = "meal-del";
  del.type = "button";
  del.textContent = "🗑 Izbriši";
  del.addEventListener("click", () => {
    if (!confirm(`Izbrišem "${meal.name}"?`)) return;
    DB.remove(meal.id).then(renderGrid);
  });
  actions.appendChild(del);

  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

// ---------------------------------------------------------- dodaj/uredi obrok
const addOverlay = document.getElementById("addOverlay");
const addModalTitle = document.getElementById("addModalTitle");
const addCategorySelect = document.getElementById("addCategory");
const addNameInput = document.getElementById("addName");
const addIngredientsInput = document.getElementById("addIngredients");
const addImageFile = document.getElementById("addImageFile");
const addPreview = document.getElementById("addPreview");
const addCancelBtn = document.getElementById("addCancel");
const addConfirmBtn = document.getElementById("addConfirm");

let pendingImageBlob = null;
let editingId = null;
let editingCreated = null;
let addPreviewUrl = null;

// Brez argumenta = dodajanje novega obroka; z obrokom = urejanje obstoječega.
function openMealModal(meal) {
  editingId = meal ? meal.id : null;
  editingCreated = meal ? meal.created : null;

  addCategorySelect.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.emoji + " " + cat.name;
    addCategorySelect.appendChild(opt);
  });

  addModalTitle.textContent = meal ? "Uredi obrok" : "Nov obrok";
  addConfirmBtn.textContent = meal ? "Shrani spremembe" : "Shrani obrok";
  addCategorySelect.value = meal ? meal.category : activeCategory;
  addNameInput.value = meal ? meal.name : "";
  addIngredientsInput.value = meal ? meal.ingredients : "";
  addImageFile.value = "";
  pendingImageBlob = meal ? meal.image : null;

  if (addPreviewUrl) { URL.revokeObjectURL(addPreviewUrl); addPreviewUrl = null; }
  if (pendingImageBlob) {
    addPreviewUrl = URL.createObjectURL(pendingImageBlob);
    addPreview.src = addPreviewUrl;
    addPreview.hidden = false;
  } else {
    addPreview.hidden = true;
    addPreview.src = "";
  }

  addOverlay.hidden = false;
  addNameInput.focus();
}

function closeAddModal() {
  addOverlay.hidden = true;
  if (addPreviewUrl) { URL.revokeObjectURL(addPreviewUrl); addPreviewUrl = null; }
}

function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMG_W / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        blob ? resolve(blob) : reject(new Error("toBlob failed"));
      }, "image/jpeg", JPEG_Q);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

addMealBtn.addEventListener("click", () => openMealModal());
addCancelBtn.addEventListener("click", closeAddModal);

addImageFile.addEventListener("change", () => {
  const file = addImageFile.files[0];
  if (!file) return;
  downscaleImage(file).then((blob) => {
    pendingImageBlob = blob;
    if (addPreviewUrl) URL.revokeObjectURL(addPreviewUrl);
    addPreviewUrl = URL.createObjectURL(blob);
    addPreview.src = addPreviewUrl;
    addPreview.hidden = false;
  });
});

addConfirmBtn.addEventListener("click", () => {
  const name = addNameInput.value.trim();
  if (!name) { addNameInput.focus(); return; }

  const record = {
    id: editingId || uid(),
    category: addCategorySelect.value,
    name: name,
    ingredients: addIngredientsInput.value.trim(),
    image: pendingImageBlob,
    created: editingId ? editingCreated : Date.now()
  };

  (editingId ? DB.update(record) : DB.add(record)).then(() => {
    closeAddModal();
    renderGrid();
  });
});

// ------------------------------------------------------------- naključni izbor
const randomOverlay = document.getElementById("randomOverlay");
const randomClose = document.getElementById("randomClose");
const randomPickStep = document.getElementById("randomPickStep");
const randomResultStep = document.getElementById("randomResultStep");
const catPickGrid = document.getElementById("catPickGrid");
const randomConfirmBtn = document.getElementById("randomConfirm");
const randomResultBody = document.getElementById("randomResultBody");
const randomBackBtn = document.getElementById("randomBack");
const randomRerollBtn = document.getElementById("randomReroll");

let pickedCategory = null;
let resultUrl = null;

function openRandomModal() {
  pickedCategory = null;
  randomConfirmBtn.disabled = true;
  catPickGrid.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-pick-btn";
    btn.innerHTML = `<span class="cat-emoji">${cat.emoji}</span>${cat.name}`;
    btn.addEventListener("click", () => {
      pickedCategory = cat.id;
      Array.from(catPickGrid.children).forEach((c) => c.classList.remove("selected"));
      btn.classList.add("selected");
      randomConfirmBtn.disabled = false;
    });
    catPickGrid.appendChild(btn);
  });
  randomPickStep.hidden = false;
  randomResultStep.hidden = true;
  randomOverlay.hidden = false;
}

function closeRandomModal() {
  randomOverlay.hidden = true;
  if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
}

function showRandomMeal() {
  DB.getAll(pickedCategory).then((meals) => {
    randomPickStep.hidden = true;
    randomResultStep.hidden = false;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }

    if (!meals.length) {
      randomResultBody.innerHTML = `<p class="result-empty">Ni še obrokov v kategoriji "${getCategory(pickedCategory).name}". Dodaj enega zgoraj.</p>`;
      randomRerollBtn.hidden = true;
      return;
    }
    randomRerollBtn.hidden = false;

    const meal = meals[Math.floor(Math.random() * meals.length)];
    randomResultBody.innerHTML = "";

    if (meal.image) {
      resultUrl = URL.createObjectURL(meal.image);
      const img = document.createElement("img");
      img.className = "result-image";
      img.src = resultUrl;
      img.alt = meal.name;
      randomResultBody.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "result-placeholder";
      ph.textContent = "🍽️";
      randomResultBody.appendChild(ph);
    }

    const name = document.createElement("div");
    name.className = "result-name";
    name.textContent = meal.name;
    randomResultBody.appendChild(name);

    if (meal.ingredients) {
      const ing = document.createElement("div");
      ing.className = "result-ingredients";
      ing.textContent = meal.ingredients;
      randomResultBody.appendChild(ing);
    }
  });
}

randomBtn.addEventListener("click", openRandomModal);
randomClose.addEventListener("click", closeRandomModal);
randomConfirmBtn.addEventListener("click", showRandomMeal);
randomRerollBtn.addEventListener("click", showRandomMeal);
randomBackBtn.addEventListener("click", () => {
  randomResultStep.hidden = true;
  randomPickStep.hidden = false;
});

// -------------------------------------------------------------- trd reset
const hardResetBtn = document.getElementById("hardResetBtn");
hardResetBtn.addEventListener("click", () => {
  hardResetBtn.disabled = true;
  hardResetBtn.classList.add("is-spinning");

  const reloadFresh = () => {
    const url = new URL(location.href);
    url.searchParams.set("_r", Date.now());
    location.replace(url.toString());
  };

  Promise.resolve()
    .then(() => {
      if (!("serviceWorker" in navigator)) return;
      return navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())));
    })
    .then(() => {
      if (!("caches" in window)) return;
      return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    })
    .catch((e) => console.warn("Trd reset ni v celoti uspel:", e))
    .then(reloadFresh);
});

// --------------------------------------------------------------------- zagon
renderTabs();
renderPanel();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
