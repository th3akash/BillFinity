const baseUrl = 'http://127.0.0.1:8000';
const ordersTbody = document.getElementById('orders-tbody');

function orderBadge(status) {
  if (!status) return '<span class="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/10">Unknown</span>';
  const s = status.toLowerCase();
  if (s.includes('complete')) return '<span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Completed</span>';
  if (s.includes('pend')) return '<span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Pending</span>';
  return '<span class="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">Canceled</span>';
}

function renderOrders(orders) {
  ordersTbody.innerHTML = '';
  if (!Array.isArray(orders) || orders.length === 0) {
    ordersTbody.innerHTML = '<tr class="bg-slate-50"><td class="px-4 py-4 text-center text-slate-600" colspan="6">No orders found</td></tr>';
    return;
  }

  const rows = orders.map(o => {
    const customerAvatar = (o.customer && o.customer.avatar) || `https://i.pravatar.cc/80?img=1`;
    const customerName = (o.customer && (o.customer.name || o.customer.full_name)) || (o.customer && o.customer.email) || '';
    const itemsDesc = Array.isArray(o.items) ? o.items.map(it => `${it.quantity || 1}× ${it.name || it.title || ''}`).join(', ') : (o.items || '');
    const total = o.total != null ? '\u20b9' + o.total : '';
    const date = (window.formatDate ? window.formatDate(o.date || o.created_at || '') : (o.date || o.created_at || ''));

    return `
      <tr class="bg-white">
        <td class="px-4 py-4 font-medium text-ink">${o.id || o.order_id || ''}</td>
        <td class="px-4 py-4">
          <div class="flex items-center gap-2">
            <img src="${customerAvatar}" class="h-8 w-8 rounded-full" alt="avatar"/>
            <div>${customerName}</div>
          </div>
        </td>
        <td class="px-4 py-4 text-slate-700">${itemsDesc}</td>
        <td class="px-4 py-4 font-semibold">${total}</td>
        <td class="px-4 py-4">${orderBadge(o.status)}</td>
        <td class="px-4 py-4 text-slate-500">${date}</td>
      </tr>`;
  }).join('');

  ordersTbody.innerHTML = rows;
}

async function fetchOrders() {
  ordersTbody.innerHTML = '<tr class="bg-white"><td class="px-4 py-4 text-center text-slate-500" colspan="6">Loading…</td></tr>';
  try {
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + '/orders', { headers: { 'Authorization': token } });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
  // Keep a local copy for filters/pagination
  window._allOrders = Array.isArray(data) ? data : [];
  window._currentPage = 1;
  applyFiltersAndRender();
  } catch (err) {
    ordersTbody.innerHTML = `<tr class="bg-rose-50"><td class="px-4 py-4 text-center text-rose-700" colspan="6">Error loading orders: ${String(err)}</td></tr>`;
  }
}

fetchOrders();

// Toast helper
function showToast(message, type = 'success', timeout = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = type === 'error' ? 'px-4 py-2 rounded-md shadow-sm bg-rose-50 border border-rose-200 text-rose-700' : 'px-4 py-2 rounded-md shadow-sm bg-emerald-50 border border-emerald-200 text-emerald-700';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

// Wire header buttons and modal
const btnExport = document.getElementById('btn-export-orders');
const btnCreateOrder = document.getElementById('btn-create-order');
const orderModal = document.getElementById('order-modal');
const orderBackdrop = document.getElementById('order-modal-backdrop');
const orderForm = document.getElementById('order-form');
const orderCancel = document.getElementById('order-cancel-btn');
const orderSubmit = document.getElementById('order-submit-btn');
const orderError = document.getElementById('order-form-error');

if (btnExport) btnExport.addEventListener('click', async () => {
  try {
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + '/orders', { headers: { 'Authorization': token } });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    // convert to CSV (simple)
    const rows = [['order_id','customer','items','total','status','date']];
    for (const o of data) rows.push([o.id || o.order_id || '', (o.customer && (o.customer.name||o.customer.email)) || '', JSON.stringify(o.items || ''), o.total || '', o.status || '', o.date || o.created_at || '']);
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Export started');
  } catch (err) {
    showToast('Export failed: ' + String(err), 'error');
  }
});

if (btnCreateOrder) btnCreateOrder.addEventListener('click', () => { if (!orderModal) return; orderModal.classList.remove('hidden'); orderModal.classList.add('flex'); });
if (orderBackdrop) orderBackdrop.addEventListener('click', () => { orderModal.classList.add('hidden'); orderModal.classList.remove('flex'); });
if (orderCancel) orderCancel.addEventListener('click', () => { orderModal.classList.add('hidden'); orderModal.classList.remove('flex'); });

orderForm && orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  orderError && orderError.classList.add('hidden');
  const customer = document.getElementById('order-customer').value;
  let items;
  try { items = JSON.parse(document.getElementById('order-items').value); } catch (e) { orderError && (orderError.textContent = 'Items must be valid JSON'); orderError && orderError.classList.remove('hidden'); return; }
  try {
    orderSubmit.disabled = true; orderSubmit.textContent = 'Creating…';
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + '/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ customer_id: customer, items }) });
    if (!res.ok) throw new Error(await res.text());
    showToast('Order created', 'success');
    orderModal.classList.add('hidden'); orderModal.classList.remove('flex');
    await fetchOrders();
  } catch (err) { orderError && (orderError.textContent = String(err)); orderError && orderError.classList.remove('hidden'); showToast('Create failed: ' + String(err), 'error'); }
  finally { orderSubmit.disabled = false; orderSubmit.textContent = 'Create'; }
});

// Open modal if hash #new
function handleHash() { const h = window.location.hash.slice(1); if (h === 'new' && orderModal) { orderModal.classList.remove('hidden'); orderModal.classList.add('flex'); } }
window.addEventListener('hashchange', handleHash); handleHash();

// --- Product picker wiring for Create Order modal ---
const pickerItem = document.getElementById('picker-item');
const pickerQty = document.getElementById('picker-qty');
const pickerAddBtn = document.getElementById('picker-add-btn');
const pickerList = document.getElementById('picker-list');
const orderItemsInput = document.getElementById('order-items');
// internal order items array: [{ item_id, name, quantity }]
window._orderItems = [];

async function fetchPickerItems() {
  if (!pickerItem) return;
  try {
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + '/items', { headers: { 'Authorization': token } });
    if (!res.ok) throw new Error(await res.text());
    const items = await res.json();
    pickerItem.innerHTML = items.map(it => `<option value="${it.id}" data-name="${(it.name||'').replace(/"/g,'&quot;')}">${it.name} (${it.sku || ''}) - ₹${it.price || 0}</option>`).join('');
  } catch (e) {
    // silent failure: leave picker empty
  }
}

function syncOrderItemsInput() {
  if (!orderItemsInput) return;
  orderItemsInput.value = JSON.stringify(window._orderItems);
}

function renderPickerList() {
  if (!pickerList) return;
  pickerList.innerHTML = '';
  window._orderItems.forEach((it, idx) => {
    const li = document.createElement('div');
    li.className = 'flex items-center gap-2 py-1';
    li.dataset.index = idx;
    li.innerHTML = `<div class="flex-1 text-sm">${it.name} <span class="text-xs text-slate-500">× ${it.quantity}</span></div><button type="button" class="text-rose-600 text-sm remove-picker-item">Remove</button>`;
    pickerList.appendChild(li);
  });
}

if (pickerAddBtn) pickerAddBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!pickerItem || !pickerQty) return;
  const itemId = pickerItem.value;
  const qty = parseInt(pickerQty.value || '1', 10) || 1;
  const selectedOption = pickerItem.selectedOptions && pickerItem.selectedOptions[0];
  const name = selectedOption ? selectedOption.dataset.name || selectedOption.textContent : 'Item';
  if (!itemId) { showToast('Please select an item', 'error'); return; }
  // if already present, increment qty
  const existing = window._orderItems.find(x => String(x.item_id) === String(itemId));
  if (existing) { existing.quantity = (existing.quantity || 0) + qty; }
  else { window._orderItems.push({ item_id: itemId, name, quantity: qty }); }
  syncOrderItemsInput(); renderPickerList();
});

// remove via event delegation
if (pickerList) pickerList.addEventListener('click', (ev) => {
  if (!ev.target.classList.contains('remove-picker-item')) return;
  const li = ev.target.closest('[data-index]');
  if (!li) return;
  const idx = Number(li.dataset.index);
  if (Number.isFinite(idx)) {
    window._orderItems.splice(idx, 1);
    syncOrderItemsInput(); renderPickerList();
  }
});

// populate picker when modal opens
if (btnCreateOrder) btnCreateOrder.addEventListener('click', () => { fetchPickerItems(); window._orderItems = []; syncOrderItemsInput(); renderPickerList(); });

// --- Filtering & Pagination ---
const filterFrom = document.getElementById('filter-from');
const filterTo = document.getElementById('filter-to');
const filterApply = document.getElementById('filter-apply');
const filterClear = document.getElementById('filter-clear');
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');
const pageInfo = document.getElementById('page-info');

window._pageSize = 10;
window._currentPage = window._currentPage || 1;

function applyDateFilter(list) {
  const from = filterFrom && filterFrom.value ? (window.asDate ? window.asDate(filterFrom.value) : new Date(filterFrom.value)) : null;
  const to = filterTo && filterTo.value ? (window.asDate ? window.asDate(filterTo.value) : new Date(filterTo.value)) : null;
  if (!from && !to) return list;
  return list.filter(o => {
    const d = (window.asDate ? window.asDate(o.date || o.created_at || o.createdAt || null) : new Date(o.date || o.created_at || o.createdAt || null));
    if (isNaN(d)) return false;
    if (from && d < from) return false;
    if (to) {
      // include entire day for 'to' by setting to end of day
      const end = new Date(to); end.setHours(23,59,59,999);
      if (d > end) return false;
    }
    return true;
  });
}

function applyFiltersAndRender() {
  const all = Array.isArray(window._allOrders) ? window._allOrders.slice() : [];
  const filtered = applyDateFilter(all);
  const total = filtered.length;
  const pageSize = Number(window._pageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (window._currentPage > totalPages) window._currentPage = totalPages;
  const start = (window._currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  renderOrders(pageItems);
  if (pageInfo) pageInfo.textContent = `Page ${window._currentPage} of ${totalPages} (${total} orders)`;
}

if (filterApply) filterApply.addEventListener('click', (e) => { e.preventDefault(); window._currentPage = 1; applyFiltersAndRender(); });
if (filterClear) filterClear.addEventListener('click', (e) => { e.preventDefault(); if (filterFrom) filterFrom.value = ''; if (filterTo) filterTo.value = ''; window._currentPage = 1; applyFiltersAndRender(); });
if (pagePrev) pagePrev.addEventListener('click', (e) => { e.preventDefault(); if (window._currentPage > 1) { window._currentPage -= 1; applyFiltersAndRender(); } });
if (pageNext) pageNext.addEventListener('click', (e) => { e.preventDefault(); window._currentPage += 1; applyFiltersAndRender(); });

// WebSocket to listen for order updates and refresh
try {
  const ws = new WebSocket('ws://127.0.0.1:8000/ws/orders');
  ws.addEventListener('message', ev => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg && msg.type === 'order_update') {
        fetchOrders();
      }
    } catch (e) {
      // ignore parse errors
    }
  });
  ws.addEventListener('error', () => { /* ignore WS errors silently */ });
} catch (e) {
  // WS unsupported or blocked
}
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF8FF',
          100: '#DBEDFF',
          200: '#C0E2FF',
          300: '#94CEFF',
          400: '#5CB5FF',
          500: '#13A4EC',
          600: '#0E86C4',
          700: '#0A6A9B',
          800: '#084F73',
          900: '#063B56',
        },
        ink: '#0d171b'
      },
      boxShadow: { card: '0 2px 12px rgba(16, 24, 40, 0.06)' },
      borderRadius: { xl2: '1rem' },
    },
  },
};
