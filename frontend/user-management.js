const baseUrl = 'http://127.0.0.1:8000';
const usersTbody = document.getElementById('users-tbody');

function userBadge(status) {
  if (!status) return '<span class="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/10">Unknown</span>';
  const s = status.toLowerCase();
  if (s.includes('active')) return '<span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Active</span>';
  if (s.includes('inv')) return '<span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Invited</span>';
  if (s.includes('suspend') || s.includes('suspended')) return '<span class="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">Suspended</span>';
  return '<span class="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/10">Unknown</span>';
}

function renderUsers(list) {
  usersTbody.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    usersTbody.innerHTML = '<tr class="bg-slate-50"><td class="px-4 py-4 text-center text-slate-600" colspan="6">No users found</td></tr>';
    return;
  }

  const rows = list.map(u => `
    <tr class="bg-white">
      <td class="px-4 py-4">
        <div class="flex items-center gap-3">
          <img src="${u.avatar || 'https://i.pravatar.cc/80?img=1'}" class="h-9 w-9 rounded-full" alt="avatar"/>
          <div>
            <div class="font-semibold text-ink">${u.name || ''}</div>
            <div class="text-xs text-slate-500">${u.role || ''}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-4">${u.email || ''}</td>
      <td class="px-4 py-4">${u.role || ''}</td>
      <td class="px-4 py-4 text-slate-500">${u.last_login || ''}</td>
      <td class="px-4 py-4">${userBadge(u.status)}</td>
      <td class="px-4 py-4">
        <div class="flex items-center gap-2">
          <button class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-card">Edit</button>
          <button class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-card">Suspend</button>
          <button class="delete-user rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-2.5 py-1.5 shadow-card">Delete</button>
        </div>
      </td>
    </tr>`).join('');

  usersTbody.innerHTML = rows;
}

async function fetchUsers() {
  usersTbody.innerHTML = '<tr class="bg-white"><td class="px-4 py-4 text-center text-slate-500" colspan="6">Loading…</td></tr>';
  try {
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + '/users', { headers: { 'Authorization': token } });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    renderUsers(data);
  } catch (err) {
    usersTbody.innerHTML = `<tr class="bg-rose-50"><td class="px-4 py-4 text-center text-rose-700" colspan="6">Error loading users: ${String(err)}</td></tr>`;
  }
}

fetchUsers();
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

// Delete modal wiring
const deleteModal = document.getElementById('delete-modal');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteBackdrop = document.getElementById('delete-modal-backdrop');
function closeDeleteModal() { if (!deleteModal) return; deleteModal.classList.add('hidden'); deleteModal.classList.remove('flex'); deleteModal.dataset.pendingId = ''; }
deleteCancelBtn && deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteBackdrop && deleteBackdrop.addEventListener('click', closeDeleteModal);

usersTbody && usersTbody.addEventListener('click', (e) => {
  const del = e.target.closest('.delete-user');
  const tr = e.target.closest('tr');
  if (!del || !tr) return;
  const id = tr.getAttribute('data-user-id') || tr.getAttribute('data-id') || '';
  const name = tr.querySelector('.font-semibold')?.textContent || '';
  const nm = document.getElementById('delete-modal-item-name');
  if (nm) nm.textContent = name;
  if (!deleteModal) return;
  deleteModal.classList.remove('hidden'); deleteModal.classList.add('flex'); deleteModal.dataset.pendingId = id;
});

deleteConfirmBtn && deleteConfirmBtn.addEventListener('click', async () => {
  if (!deleteModal) return;
  const id = deleteModal.dataset.pendingId;
  if (!id) return closeDeleteModal();
  try {
    deleteConfirmBtn.disabled = true; deleteConfirmBtn.textContent = 'Deleting…';
    const token = localStorage.IF_TOKEN;
    const res = await fetch(baseUrl + `/users/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
    if (res.status === 204) { showToast('User deleted', 'success'); await fetchUsers(); }
    else { const txt = await res.text(); throw new Error(txt || res.statusText); }
  } catch (err) { showToast('Error deleting user: ' + String(err), 'error'); }
  finally { if (deleteConfirmBtn) { deleteConfirmBtn.disabled = false; deleteConfirmBtn.textContent = 'Delete'; } closeDeleteModal(); }
});
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
        ink: '#0d171b',
      },
      boxShadow: { card: '0 2px 12px rgba(16, 24, 40, 0.06)' },
      borderRadius: { xl2: '1rem' },
    },
  },
};