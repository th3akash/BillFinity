const baseUrl = 'http://127.0.0.1:8000';
const itemsTbody = document.getElementById('items-tbody');

function badgeForStatus(status) {
  if (!status) return '<span class="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/10">Unknown</span>';
  const s = status.toLowerCase();
  if (s.includes('in')) return '<span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">In Stock</span>';
  if (s.includes('low')) return '<span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Low Stock</span>';
  return '<span class="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">Out of Stock</span>';
}

function renderItems(items) {
  itemsTbody.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    itemsTbody.innerHTML = '<tr class="bg-slate-50"><td class="px-4 py-4 text-center text-slate-600" colspan="8">No items found</td></tr>';
    return;
  }

  const rows = items.map(item => {
    const img = item.image || 'https://placehold.co/80x80/E2E8F0/E2E8F0/svg?text=Item';
    const price = item.price != null ? '\u20b9' + item.price : '';
    const reorder = item.reorder_point != null ? item.reorder_point : '';
    const qty = (item.stock != null ? item.stock : (item.in_stock != null ? item.in_stock : 0));
    const status = item.status || (qty > 0 ? 'In Stock' : 'Out of Stock');

  return `
  <tr data-item-id="${item.id}" class="bg-white">
        <td class="px-4 py-4">
          <div class="flex items-center gap-3">
            <img src="${img}" class="h-9 w-9 rounded" alt="Item image"/>
            <div class="font-semibold text-ink">${item.name || ''}</div>
          </div>
        </td>
        <td class="px-4 py-4">${item.sku || ''}</td>
        <td class="px-4 py-4 text-slate-700">${item.category || ''}</td>
        <td class="px-4 py-4 font-semibold">${qty}</td>
        <td class="px-4 py-4">${price}</td>
        <td class="px-4 py-4 font-medium">${reorder}</td>
        <td class="px-4 py-4">${badgeForStatus(status)}</td>
        <td class="px-4 py-4">
            <div class="flex items-center gap-2">
            <button class="edit-item rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-card">Edit</button>
            <button class="reorder-item rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-card">Reorder</button>
            <button class="delete-item rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-2.5 py-1.5 shadow-card">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  itemsTbody.innerHTML = rows;
}

// Simple toast helper
function showToast(message, type = 'success', timeout = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const id = 't-' + Date.now();
  const bg = type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700';
  const el = document.createElement('div');
  el.id = id;
  el.className = `px-4 py-2 rounded-md shadow-sm flex items-center gap-3 ${bg}`;
  const msg = document.createElement('div');
  msg.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'text-sm opacity-80 hover:opacity-100';
  btn.setAttribute('aria-label', 'Dismiss');
  btn.innerHTML = '&times;';
  btn.addEventListener('click', () => { el.remove(); });
  el.appendChild(msg);
  el.appendChild(btn);
  container.appendChild(el);
  const t = setTimeout(() => { el.remove(); }, timeout);
  // ensure timeout cleared if removed manually
  el.addEventListener('remove', () => clearTimeout(t));
}

async function fetchItems() {
  itemsTbody.innerHTML = '<tr class="bg-white"><td class="px-4 py-4 text-center text-slate-500" colspan="8">Loading…</td></tr>';
  try {
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + '/items', { headers: { 'Authorization': token } });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    renderItems(data);
  } catch (err) {
    itemsTbody.innerHTML = `<tr class="bg-rose-50"><td class="px-4 py-4 text-center text-rose-700" colspan="8">Error loading items: ${String(err)}</td></tr>`;
  }
}

fetchItems();
// Open modal if page loaded with hash (e.g. items.html#add or items.html#edit:123)
function handleHash() {
  const h = window.location.hash.slice(1);
  if (!h) return;
  if (h === 'add') return openItemModal(null);
  if (h.startsWith('edit:')) {
    const id = h.split(':', 2)[1];
    // fetch item and open
    (async () => {
      try {
        const token = localStorage.IF_TOKEN;
        const res = await fetch(baseUrl + '/items', { headers: { 'Authorization': token } });
        if (!res.ok) throw new Error(await res.text());
        const list = await res.json();
        const item = list.find(i => String(i.id) === String(id));
        openItemModal(item || null);
      } catch (e) { console.error(e); }
    })();
  }
}
window.addEventListener('hashchange', handleHash);
handleHash();
// --- Item modal & CRUD handlers ---
const addItemBtn = document.getElementById('add-item-btn');
const itemModal = document.getElementById('item-modal');
const itemBackdrop = document.getElementById('item-modal-backdrop');
const itemForm = document.getElementById('item-form');
const itemFormError = document.getElementById('item-form-error');

function openItemModal(data = null) {
  if (!itemModal) return;
  // populate fields
  document.getElementById('item-id').value = data && data.id ? data.id : '';
  document.getElementById('item-name').value = data && data.name ? data.name : '';
  document.getElementById('item-sku').value = data && data.sku ? data.sku : '';
  document.getElementById('item-category').value = data && data.category ? data.category : '';
  document.getElementById('item-price').value = data && data.price ? data.price : '';
document.getElementById('item-stock').value = data && (data.stock != null ? data.stock : data.in_stock) ? (data.stock != null ? data.stock : data.in_stock) : '';
  document.getElementById('item-reorder').value = data && data.reorder_point ? data.reorder_point : '';
  try { document.getElementById('item-gst').value = (data && (data.gst_rate != null) ? String(data.gst_rate) : '18'); } catch(_){ }
  itemFormError.classList.add('hidden');
  itemModal.classList.remove('hidden');
  itemModal.classList.add('flex');
}

function closeItemModal() {
  if (!itemModal) return;
  itemModal.classList.add('hidden');
  itemModal.classList.remove('flex');
}

if (addItemBtn) addItemBtn.addEventListener('click', () => openItemModal(null));
if (itemBackdrop) itemBackdrop.addEventListener('click', closeItemModal);
const itemCancelBtn = document.getElementById('item-cancel-btn');
if (itemCancelBtn) itemCancelBtn.addEventListener('click', closeItemModal);

itemForm && itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  itemFormError.classList.add('hidden');
  const id = document.getElementById('item-id').value;
  const payload = {
    name: document.getElementById('item-name').value.trim(),
    sku: document.getElementById('item-sku').value.trim(),
    category: document.getElementById('item-category').value.trim(),
    price: parseFloat(document.getElementById('item-price').value) || 0,
    stock: parseInt(document.getElementById('item-stock').value) || 0,
    reorder_point: parseInt(document.getElementById('item-reorder').value) || 0,
    gst_rate: (function(){ const v = parseInt(document.getElementById('item-gst').value || '18', 10); return [0,5,12,18,28].includes(v) ? v : 18; })(),
  };

  // Client-side validation
  if (!payload.name || !payload.sku) {
    itemFormError.textContent = 'Name and SKU are required.';
    itemFormError.classList.remove('hidden');
    return;
  }
  if (payload.price < 0 || payload.stock < 0 || payload.reorder_point < 0) {
    itemFormError.textContent = 'Price, stock and reorder point must be non-negative.';
    itemFormError.classList.remove('hidden');
    return;
  }

  const saveBtn = document.getElementById('item-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    const token = localStorage.IF_TOKEN;
    let res;
    if (!id) {
      // Create
      res = await fetch(baseUrl + '/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
    } else {
      // Update full item via PATCH /items/{id}
      res = await fetch(baseUrl + `/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
    }
    await fetchItems();
    closeItemModal();
    showToast(id ? 'Item updated' : 'Item created', 'success');
  } catch (err) {
    itemFormError.textContent = String(err);
    itemFormError.classList.remove('hidden');
    showToast('Error saving item: ' + String(err), 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
  }
});

// Event delegation for Edit/Reorder buttons
itemsTbody && itemsTbody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-item');
  const reorderBtn = e.target.closest('.reorder-item');
  const tr = e.target.closest('tr');
  if (!tr) return;
  const itemId = tr.getAttribute('data-item-id');
  if (editBtn) {
    // fetch item details and open modal for editing
    (async () => {
      try {
        const token = localStorage.IF_TOKEN;
        const res = await fetch(baseUrl + '/items', { headers: { 'Authorization': token } });
        if (!res.ok) throw new Error(await res.text());
        const list = await res.json();
        const item = list.find(i => String(i.id) === String(itemId));
        openItemModal(item || null);
      } catch (err) {
        alert('Error fetching item details: ' + String(err));
      }
    })();
    return;
  }
  if (reorderBtn) {
    // simple prompt to add stock
    (async () => {
      try {
        const add = parseInt(prompt('Enter quantity to add to stock', '1')); 
        if (!add || isNaN(add) || add <= 0) return;
        // fetch current item to get stock
        const token = localStorage.IF_TOKEN;
        const res = await fetch(baseUrl + '/items', { headers: { 'Authorization': token } });
        if (!res.ok) throw new Error(await res.text());
        const list = await res.json();
        const item = list.find(i => String(i.id) === String(itemId));
        if (!item) throw new Error('Item not found');
        const newStock = ((item.stock != null ? item.stock : item.in_stock) || 0) + add;
        const patch = await fetch(baseUrl + `/items/${itemId}/stock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': token },
          body: JSON.stringify({ stock: newStock })
        });
        if (!patch.ok) throw new Error(await patch.text());
        await fetchItems();
      } catch (err) {
        alert('Error updating stock: ' + String(err));
      }
    })();
    return;
  }
  const deleteBtn = e.target.closest('.delete-item');
  if (deleteBtn) {
    // open modal instead of native confirm
    const deleteModal = document.getElementById('delete-modal');
    const deleteName = document.getElementById('delete-modal-item-name');
    const trEl = deleteBtn.closest('tr');
    const name = trEl ? trEl.querySelector('.font-semibold')?.textContent || '' : '';
    const id = itemId;
    if (deleteName) deleteName.textContent = name;
    if (!deleteModal) return;
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('flex');
    // store pending id on modal element
    deleteModal.dataset.pendingId = id;
    return;
  }
});

// Delete modal buttons
const deleteModal = document.getElementById('delete-modal');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteBackdrop = document.getElementById('delete-modal-backdrop');

function closeDeleteModal() {
  if (!deleteModal) return;
  deleteModal.classList.add('hidden');
  deleteModal.classList.remove('flex');
  deleteModal.dataset.pendingId = '';
}

if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
if (deleteBackdrop) deleteBackdrop.addEventListener('click', closeDeleteModal);

if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', async () => {
  if (!deleteModal) return;
  const id = deleteModal.dataset.pendingId;
  if (!id) return closeDeleteModal();
  try {
    // show loading state
    deleteConfirmBtn.disabled = true;
    const prev = deleteConfirmBtn.textContent;
    deleteConfirmBtn.textContent = 'Deleting…';
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + `/items/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
    if (res.status === 204) {
      showToast('Item deleted', 'success');
      await fetchItems();
    } else {
      const txt = await res.text();
      throw new Error(txt || res.statusText);
    }
  } catch (err) {
    showToast('Error deleting item: ' + String(err), 'error');
  } finally {
    if (deleteConfirmBtn) { deleteConfirmBtn.disabled = false; deleteConfirmBtn.textContent = 'Delete'; }
    closeDeleteModal();
  }
});

// Slight change: include item id as data attribute when rendering
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
