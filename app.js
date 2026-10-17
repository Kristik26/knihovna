// Kritéria hodnocení 1-10 podle nákresu
const CRITERIA_LIST = [
  { key: 'writing', label: 'kvalita psaní' },
  { key: 'story', label: 'úroveň příběhu' },
  { key: 'tension', label: 'tenze' },
  { key: 'characters', label: 'postavy' },
  { key: 'readability', label: 'snadnost čtení' },
  { key: 'lovestory', label: 'love story' },
  { key: 'ending', label: 'konec' }
];

let books = [];
let currentBook = null;
let selectedMoodItemId = null;
let isMoodboardEditMode = false;
let dragState = null;

// ==========================================
// DATABÁZE (IndexedDB - zvládne spoustu fotek)
// ==========================================
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('VisualLibraryDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAllBooks() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('books', 'readonly');
    const req = tx.objectStore('books').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function dbSaveBook(book) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').put(book);
    tx.oncomplete = () => resolve();
  });
}

async function dbDeleteBook(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').delete(id);
    tx.oncomplete = () => resolve();
  });
}

// ==========================================
// VYKRESLENÍ HLAVNÍ OBRAZOVKY (POLIČKY)
// ==========================================
async function loadAndRenderLibrary() {
  books = await dbGetAllBooks();
  books.sort((a, b) => a.addedAt - b.addedAt);

  const bookshelf = document.getElementById('bookshelf');
  const booksPerShelf = 6;
  const minShelves = 5;
  const totalShelves = Math.max(minShelves, Math.ceil(books.length / booksPerShelf));

  bookshelf.innerHTML = '';

  for (let i = 0; i < totalShelves; i++) {
    const shelfRow = document.createElement('div');
    shelfRow.className = 'shelf-row';

    const shelfBooks = books.slice(i * booksPerShelf, (i + 1) * booksPerShelf);
    shelfBooks.forEach(book => {
      const rating = Number(book.overallRating) || 0;
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

      const bookEl = document.createElement('div');
      bookEl.className = 'book-item';
      bookEl.title = book.title || 'Bez názvu';
      bookEl.onclick = () => openBookModal(book.id);

      const coverHtml = book.cover
        ? `<img class="book-cover" src="${book.cover}" alt="${book.title}">`
        : `<div class="book-cover">${book.title || 'Kniha'}</div>`;

      bookEl.innerHTML = `
        ${coverHtml}
        <div class="book-stars">${stars}</div>
      `;
      shelfRow.appendChild(bookEl);
    });

    bookshelf.appendChild(shelfRow);
  }
}

// ==========================================
// OTEVŘENÍ / ZAVŘENÍ DETAILU KNIHY
// ==========================================
function selectBookType(val) {
  currentBook.bookType = val;
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === val);
  });
}
function createEmptyBook() {
  return {
    id: 'book_' + Date.now(),
    addedAt: Date.now(),
    title: '',
    author: '',
    genre: '',
    pages: '',
    dateFrom: '',
    dateTo: '',
    readTime: '',
    series: '',
    format: 'physical',
    bookType: 'KNIHA',
    reread: '',
    overallRating: 5,
    spiceLevel: 0,
    criteria: {},
    description: '',
    cover: '',
    moodboard: []
  };
}
// Tuto novou funkci vlož kamkoliv do app.js:
function toggleMoodboardEdit() {
  isMoodboardEditMode = !isMoodboardEditMode;
  if (!isMoodboardEditMode) {
    selectedMoodItemId = null; // Zruší výběr obrázku při zamknutí
  }
  renderMoodboard();
}

function openBookModal(bookId = null) {
  if (bookId) {
    const found = books.find(b => b.id === bookId);
    currentBook = JSON.parse(JSON.stringify(found));
    document.getElementById('deleteBookBtn').classList.remove('hidden');
  } else {
    currentBook = createEmptyBook();
    document.getElementById('deleteBookBtn').classList.add('hidden');
  }

  selectedMoodItemId = null;
  isMoodboardEditMode = false;
  populateModalFields();
  document.getElementById('bookModal').classList.remove('hidden');
}

function closeBookModal() {
  document.getElementById('bookModal').classList.add('hidden');
  currentBook = null;
}

function populateModalFields() {
  document.getElementById('f_title').value = currentBook.title || '';
  document.getElementById('f_author').value = currentBook.author || '';
  document.getElementById('f_genre').value = currentBook.genre || '';
  document.getElementById('f_pages').value = currentBook.pages || '';
  document.getElementById('f_dateFrom').value = currentBook.dateFrom || '';
  document.getElementById('f_dateTo').value = currentBook.dateTo || '';
  document.getElementById('f_time').value = currentBook.readTime || '';
  document.getElementById('f_series').value = currentBook.series || '';
  selectBookType(currentBook.bookType || 'KNIHA');
  document.getElementById('f_description').value = currentBook.description || '';

  updateCoverPreview();
  renderStars();
  renderSpice();
  renderCriteria();
  selectFormat(currentBook.format || 'physical');
  selectReread(currentBook.reread || '');
  renderMoodboard();
}

// ==========================================
// INTERAKTIVNÍ PRVKY KARTY (Hvězdy, Spice, 1-10)
// ==========================================
function renderStars() {
  const containers = ['leftStars', 'mainStars'];
  containers.forEach(cid => {
    const el = document.getElementById(cid);
    el.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const span = document.createElement('span');
      span.className = 'star-char' + (i <= currentBook.overallRating ? ' active' : '');
      span.textContent = '★';
      span.onclick = () => {
        currentBook.overallRating = i;
        renderStars();
      };
      el.appendChild(span);
    }
  });
}

function renderSpice() {
  const el = document.getElementById('spicePicker');
  el.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.className = 'spice-char' + (i <= currentBook.spiceLevel ? ' active' : '');
    span.textContent = '🔥';
    span.onclick = () => {
      currentBook.spiceLevel = (currentBook.spiceLevel === i) ? 0 : i;
      renderSpice();
    };
    el.appendChild(span);
  }
}

function renderCriteria() {
  const box = document.getElementById('criteriaBox');
  box.innerHTML = '';

  CRITERIA_LIST.forEach(crit => {
    const row = document.createElement('div');
    row.className = 'criterion-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'criterion-name';
    nameSpan.textContent = crit.label;

    const scaleDiv = document.createElement('div');
    scaleDiv.className = 'num-scale';

    const currentVal = currentBook.criteria[crit.key] || 0;

    for (let n = 1; n <= 10; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'num-btn' + (currentVal === n ? ' active' : '');
      btn.textContent = n;
      btn.onclick = () => {
        currentBook.criteria[crit.key] = n;
        renderCriteria();
      };
      scaleDiv.appendChild(btn);
    }

    row.appendChild(nameSpan);
    row.appendChild(scaleDiv);
    box.appendChild(row);
  });
}

function selectFormat(fmt) {
  currentBook.format = fmt;
  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === fmt);
  });
}

function selectReread(val) {
  currentBook.reread = val;
  document.querySelectorAll('[data-reread]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.reread === val);
  });
}

// ==========================================
// NAHRÁVÁNÍ OBRÁZKŮ (Automatické zmenšení pro rychlost)
// ==========================================
function resizeImageFile(file, maxSize = 650) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleCoverUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  currentBook.cover = await resizeImageFile(file, 500);
  updateCoverPreview();
}

function updateCoverPreview() {
  const img = document.getElementById('coverPreviewImg');
  const placeholder = document.getElementById('coverPlaceholder');
  if (currentBook.cover) {
    img.src = currentBook.cover;
    img.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

// ==========================================
// MOODBOARD (Přesouvání, Velikost, Do popředí / Do pozadí)
// ==========================================
async function handleMoodboardUpload(event) {
  const files = Array.from(event.target.files);
  for (const file of files) {
    const dataUrl = await resizeImageFile(file, 650);
    addMoodboardImage(dataUrl);
  }
  event.target.value = '';
}

// Podpora vložení obrázku do Moodboardu přes Ctrl+V
window.addEventListener('paste', async (e) => {
  if (!currentBook) return;
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      const dataUrl = await resizeImageFile(file, 650);
      addMoodboardImage(dataUrl);
    }
  }
});

function addMoodboardImage(src) {
  const maxZ = currentBook.moodboard.reduce((max, item) => Math.max(max, item.zIndex || 1), 0);
  const newItem = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    src,
    x: 30 + (currentBook.moodboard.length * 25) % 250,
    y: 25 + (currentBook.moodboard.length * 20) % 140,
    width: 170,
    rotation: 0,
    zIndex: maxZ + 1
  };
  currentBook.moodboard.push(newItem);
  selectedMoodItemId = newItem.id;
  renderMoodboard();
}

function renderMoodboard() {
  const canvas = document.getElementById('moodboardCanvas');
  const hint = document.getElementById('moodboardHint');
  const toolbar = document.getElementById('imgToolbar');
  const editTools = document.getElementById('moodboardEditTools');
  const editBtn = document.getElementById('editMoodboardBtn');

  // Přepínání vzhledu tlačítka tužky a panelu nástrojů
  editTools.classList.toggle('hidden', !isMoodboardEditMode);
  canvas.classList.toggle('locked', !isMoodboardEditMode);
  editBtn.classList.toggle('edit-active', isMoodboardEditMode);
  editBtn.innerHTML = isMoodboardEditMode ? '🔒 Hotovo' : '✏️ Upravit';

  canvas.querySelectorAll('.mood-img').forEach(el => el.remove());

  if (currentBook.moodboard.length === 0) {
    hint.classList.remove('hidden');
    hint.innerHTML = isMoodboardEditMode
      ? 'Klikni na „+ Přidat obrázek“ nebo sem vlož obrázek přes Ctrl+V.'
      : 'Moodboard je prázdný. Klikni na „✏️ Upravit“ pro přidání obrázků.';
  } else {
    hint.classList.add('hidden');
  }

  toolbar.classList.toggle('hidden', !isMoodboardEditMode || !selectedMoodItemId);

  currentBook.moodboard.forEach(item => {
    const img = document.createElement('img');
    img.src = item.src;
    img.className = 'mood-img' + (isMoodboardEditMode && item.id === selectedMoodItemId ? ' selected' : '');
    img.style.left = item.x + 'px';
    img.style.top = item.y + 'px';
    img.style.width = item.width + 'px';
    img.style.zIndex = item.zIndex || 1;
    img.style.transform = `rotate(${item.rotation || 0}deg)`;

    // Posouvání a vybírání funguje jen když je zapnutá tužka
    if (isMoodboardEditMode) {
      img.onmousedown = (e) => startDragMoodImg(e, item);
      img.onclick = (e) => {
        e.stopPropagation();
        selectedMoodItemId = item.id;
        renderMoodboard();
      };
    }

    canvas.appendChild(img);
  });
}

function startDragMoodImg(e, item) {
  e.preventDefault();
  e.stopPropagation();
  selectedMoodItemId = item.id;

  const startX = e.clientX - item.x;
  const startY = e.clientY - item.y;

  function onMouseMove(ev) {
    item.x = ev.clientX - startX;
    item.y = ev.clientY - startY;
    renderMoodboard();
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  renderMoodboard();
}

function deselectMoodboardImg(e) {
  if (e.target.id === 'moodboardCanvas') {
    selectedMoodItemId = null;
    renderMoodboard();
  }
}

function getSelectedMoodItem() {
  return currentBook?.moodboard.find(i => i.id === selectedMoodItemId);
}

function changeZIndex(delta) {
  const item = getSelectedMoodItem();
  if (!item) return;
  item.zIndex = Math.max(1, (item.zIndex || 1) + delta);
  renderMoodboard();
}

function scaleSelectedImg(deltaPx) {
  const item = getSelectedMoodItem();
  if (!item) return;
  item.width = Math.max(60, Math.min(500, item.width + deltaPx));
  renderMoodboard();
}

function rotateSelectedImg(deg) {
  const item = getSelectedMoodItem();
  if (!item) return;
  item.rotation = (item.rotation || 0) + deg;
  renderMoodboard();
}

function removeSelectedImg() {
  if (!selectedMoodItemId) return;
  currentBook.moodboard = currentBook.moodboard.filter(i => i.id !== selectedMoodItemId);
  selectedMoodItemId = null;
  renderMoodboard();
}

// ==========================================
// ULOŽENÍ A SMAZÁNÍ KNIHY
// ==========================================
async function saveCurrentBook() {
  currentBook.title = document.getElementById('f_title').value.trim();
  currentBook.author = document.getElementById('f_author').value.trim();
  currentBook.genre = document.getElementById('f_genre').value.trim();
  currentBook.pages = document.getElementById('f_pages').value;
  currentBook.dateFrom = document.getElementById('f_dateFrom').value;
  currentBook.dateTo = document.getElementById('f_dateTo').value;
  currentBook.readTime = document.getElementById('f_time').value.trim();
  currentBook.series = document.getElementById('f_series').value.trim();
  currentBook.description = document.getElementById('f_description').value;

  if (!currentBook.title && !currentBook.cover) {
    alert('Zadej prosím alespoň název knihy nebo nahraj přebal.');
    return;
  }

  await dbSaveBook(currentBook);
  closeBookModal();
  await loadAndRenderLibrary();
}

async function deleteCurrentBook() {
  if (!currentBook) return;
  if (confirm(`Opravdu chceš smazat knihu "${currentBook.title || 'Bez názvu'}"?`)) {
    await dbDeleteBook(currentBook.id);
    closeBookModal();
    await loadAndRenderLibrary();
  }
}

// Spuštění po načtení
loadAndRenderLibrary();