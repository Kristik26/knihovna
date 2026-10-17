let tbrItems = [];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('VisualLibraryDB', 5);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('series')) {
        db.createObjectStore('series', { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains('tbr')) {
        db.createObjectStore('tbr', { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // DŮLEŽITÉ: Pokud jiná stránka potřebuje zvednout verzi DB, okamžitě uvolníme spojení
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

async function dbGetAllTbr() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('tbr', 'readonly');
    const req = tx.objectStore('tbr').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function dbPutTbr(item) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('tbr', 'readwrite');
    tx.objectStore('tbr').put(item);
    tx.oncomplete = () => resolve();
  });
}

async function dbDeleteTbr(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('tbr', 'readwrite');
    tx.objectStore('tbr').delete(id);
    tx.oncomplete = () => resolve();
  });
}

async function loadAndRenderTbr() {
  tbrItems = await dbGetAllTbr();

  // Neodfajfkované nahoře, odfajfkované dole, jinak podle času přidání
  tbrItems.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.createdAt - b.createdAt;
  });

  const listEl = document.getElementById('tbrList');
  listEl.innerHTML = '';

  if (tbrItems.length === 0) {
    listEl.innerHTML = '<div class="tbr-empty">Seznam je zatím prázdný. Přidej si první knížku přes „+“ nahoře!</div>';
    return;
  }

  tbrItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'tbr-item' + (item.done ? ' done' : '');

    row.innerHTML = `
      <label class="tbr-check-label">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleTbrDone('${item.id}')">
        <span class="custom-checkbox"></span>
        <span class="tbr-text">${escapeHtml(item.text)}</span>
      </label>
      <button class="tbr-delete-btn" onclick="removeTbrItem('${item.id}')" title="Smazat">✕</button>
    `;

    listEl.appendChild(row);
  });
}

async function addTbrItem() {
  const input = document.getElementById('tbrInput');
  const text = input.value.trim();
  if (!text) return;

  const newItem = {
    id: 'tbr_' + Date.now(),
    text,
    done: false,
    createdAt: Date.now()
  };

  input.value = '';
  await dbPutTbr(newItem);
  await loadAndRenderTbr();
}

async function toggleTbrDone(id) {
  const item = tbrItems.find(i => i.id === id);
  if (!item) return;
  item.done = !item.done;
  await dbPutTbr(item);
  await loadAndRenderTbr();
}

async function removeTbrItem(id) {
  await dbDeleteTbr(id);
  await loadAndRenderTbr();
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

loadAndRenderTbr();