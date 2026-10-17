let allBooks = [];
let seriesMetaList = []; // Uložené popisky a ručně vytvořené série
let activeSeriesName = '';

// Otevření databáze (verze 2 přidává tabulku 'series' pro poznámky k sériím)
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

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
  });
}

async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
  });
}

// Načtení všech sérií (z knih i ručně vytvořených)
async function initSeriesPage() {
  allBooks = await dbGetAll('books');
  seriesMetaList = await dbGetAll('series');

  // Získáme unikátní názvy sérií ze všech knih + z uložených sérií
  const namesSet = new Set();
  allBooks.forEach(b => {
    if (b.series && b.series.trim() !== '') {
      namesSet.add(b.series.trim());
    }
  });
  seriesMetaList.forEach(s => {
    if (s.name) namesSet.add(s.name);
  });

  const allSeriesNames = Array.from(namesSet).sort((a, b) => a.localeCompare(b, 'cs'));
  const select = document.getElementById('seriesSelect');
  select.innerHTML = '';

  if (allSeriesNames.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Zatím žádná série --';
    select.appendChild(opt);
    activeSeriesName = '';
    renderActiveSeries();
    return;
  }

  allSeriesNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (!activeSeriesName || !allSeriesNames.includes(activeSeriesName)) {
    activeSeriesName = allSeriesNames[0];
  }
  select.value = activeSeriesName;
  renderActiveSeries();
}

function selectSeries(name) {
  activeSeriesName = name;
  renderActiveSeries();
}

// Vykreslení vybrané série a jejích knih
function renderActiveSeries() {
  const authorInput = document.getElementById('s_author');
  const nameInput = document.getElementById('s_name');
  const descInput = document.getElementById('s_description');
  const strip = document.getElementById('seriesBooksStrip');

  if (!activeSeriesName) {
    authorInput.value = '';
    nameInput.value = '';
    descInput.value = '';
    strip.innerHTML = '<div style="padding: 40px; color: #8a7a6c;">Zatím nemáš žádné série. Zadej sérii u knihy nebo klikni nahoře na „+ Nová série“.</div>';
    return;
  }

  // Najdeme všechny knihy patřící do této série (seřazené podle přidání)
  const booksInSeries = allBooks
    .filter(b => (b.series || '').trim().toLowerCase() === activeSeriesName.toLowerCase())
    .sort((a, b) => a.addedAt - b.addedAt);

  // Najdeme uložené poznámky k této sérii
  const savedMeta = seriesMetaList.find(s => s.name.toLowerCase() === activeSeriesName.toLowerCase()) || {};

  // Automatické doplnění autora z první knihy v sérii (pokud není ručně přepsán)
  const autoAuthor = booksInSeries.find(b => b.author)?.author || '';
  authorInput.value = savedMeta.author || autoAuthor;
  nameInput.value = activeSeriesName;
  descInput.value = savedMeta.description || '';

  // Vykreslíme minimálně 7 sloupců (jako na tvém nákresu)
  const minSlots = 7;
  const totalSlots = Math.max(minSlots, booksInSeries.length);
  strip.innerHTML = '';

  for (let i = 0; i < totalSlots; i++) {
    const book = booksInSeries[i];
    const slot = document.createElement('div');
    slot.className = 'series-slot';

    if (book) {
      const rating = Number(book.overallRating) || 0;
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const dateText = book.dateTo || book.dateFrom || '—';
      const timeText = book.readTime || '—';
      const pagesText = book.pages ? `${book.pages} str.` : '—';

      const coverHtml = book.cover
        ? `<img src="${book.cover}" alt="${book.title}" class="series-book-cover">`
        : `<div class="series-book-placeholder">${book.title || 'Bez názvu'}</div>`;

      slot.innerHTML = `
        <div class="slot-hole">${i + 1}</div>
        <div class="slot-cover-area" title="${book.title}">
          ${coverHtml}
        </div>
        <div class="slot-footer">
          <div class="sf-line" title="Datum přečtení">📅 ${dateText}</div>
          <div class="sf-line" title="Čas čtení">⏱ ${timeText}</div>
          <div class="sf-line" title="Počet stránek">📖 ${pagesText}</div>
          <div class="sf-stars">${stars}</div>
        </div>
      `;
    } else {
      // Prázdný sloupec jako na papírové předloze
      slot.innerHTML = `
        <div class="slot-hole"></div>
        <div class="slot-cover-area empty"></div>
        <div class="slot-footer empty">
          <div class="sf-line">&nbsp;</div>
          <div class="sf-line">&nbsp;</div>
          <div class="sf-line">&nbsp;</div>
          <div class="sf-stars">&nbsp;</div>
        </div>
      `;
    }

    strip.appendChild(slot);
  }
}

// Uložení poznámek a autora série při psaní
async function saveSeriesMeta() {
  if (!activeSeriesName) return;
  const author = document.getElementById('s_author').value;
  const description = document.getElementById('s_description').value;

  const data = {
    name: activeSeriesName,
    author,
    description
  };

  const idx = seriesMetaList.findIndex(s => s.name === activeSeriesName);
  if (idx >= 0) seriesMetaList[idx] = data;
  else seriesMetaList.push(data);

  await dbPut('series', data);
}

// Ruční vytvoření nové série dopředu
async function createNewSeries() {
  const name = prompt('Zadej název nové série:');
  if (!name || !name.trim()) return;
  const cleanName = name.trim();

  const author = prompt('Zadej autora série (nepovinné – jinak se doplní sám podle první knihy):', '') || '';

  await dbPut('series', {
    name: cleanName,
    author: author.trim(),
    description: ''
  });

  activeSeriesName = cleanName;
  await initSeriesPage();
}

async function deleteCurrentSeries() {
  if (!activeSeriesName) return;
  if (confirm(`Opravdu chceš smazat poznámky k sérii "${activeSeriesName}"? (Samotné knihy v knihovně zůstanou).`)) {
    await dbDelete('series', activeSeriesName);
    activeSeriesName = '';
    await initSeriesPage();
  }
}

initSeriesPage();