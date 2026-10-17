const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

let allBooks = [];
let viewDate = new Date(); // Výchozí je aktuální měsíc a rok

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

async function initCalendar() {
  allBooks = await dbGetAllBooks();
  renderCalendar();
}

function changeMonth(delta) {
  viewDate.setMonth(viewDate.getMonth() + delta);
  renderCalendar();
}

function formatCzechDate(dateFrom, dateTo) {
  const fmt = (dStr) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-');
    return `${Number(d)}. ${Number(m)}. ${y}`;
  };
  if (dateFrom && dateTo && dateFrom !== dateTo) {
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  }
  return fmt(dateTo || dateFrom);
}

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-11

  document.getElementById('currentMonthLabel').textContent = `${CZECH_MONTHS[month]} ${year}`;

  // Vyfiltrujeme knihy přečtené v tomto měsíci a roce (bere se datum 'do', případně 'od')
  const monthBooks = allBooks.filter(book => {
    const targetDateStr = book.dateTo || book.dateFrom;
    if (!targetDateStr) return false;
    const [bYear, bMonth] = targetDateStr.split('-').map(Number);
    return bYear === year && (bMonth - 1) === month;
  });

  // Seřadíme chronologicky podle dne v měsíci
  monthBooks.sort((a, b) => {
    const dA = a.dateTo || a.dateFrom;
    const dB = b.dateTo || b.dateFrom;
    return dA.localeCompare(dB);
  });

  const summaryEl = document.getElementById('monthSummary');
  const totalPages = monthBooks.reduce((sum, b) => sum + (Number(b.pages) || 0), 0);
  summaryEl.textContent = `Přečteno knih: ${monthBooks.length}` + (totalPages > 0 ? `  •  Celkem stran: ${totalPages}` : '');

  const listEl = document.getElementById('calendarList');
  listEl.innerHTML = '';

  if (monthBooks.length === 0) {
    listEl.innerHTML = `<div class="tbr-empty">V měsíci ${CZECH_MONTHS[month].toLowerCase()} ${year} zatím nemáš zaznamenanou žádnou přečtenou knihu. (U knihy stačí vyplnit „DATUM od / do“).</div>`;
    return;
  }

  monthBooks.forEach(book => {
    const row = document.createElement('div');
    row.className = 'cal-book-row';

    const dateFormatted = formatCzechDate(book.dateFrom, book.dateTo);
    const rating = Number(book.overallRating) || 0;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    const coverHtml = book.cover
      ? `<img src="${book.cover}" alt="${book.title}" class="cal-mini-cover">`
      : `<div class="cal-mini-cover placeholder">📖</div>`;

    row.innerHTML = `
      <div class="cal-date-badge">${dateFormatted}</div>
      ${coverHtml}
      <div class="cal-book-info">
        <div class="cal-book-title">${escapeHtml(book.title || 'Bez názvu')}</div>
        <div class="cal-book-author">${escapeHtml(book.author || 'Neznámý autor')}</div>
      </div>
      <div class="cal-book-stars">${stars}</div>
    `;

    listEl.appendChild(row);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

initCalendar();