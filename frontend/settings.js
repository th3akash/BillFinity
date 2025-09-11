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

(function() {
  const baseUrl = 'http://127.0.0.1:8000';
  const el = (id) => document.getElementById(id);

  function authHeaders() {
    const headers = {};
    try { let t = localStorage.getItem('IF_TOKEN'); if (t) { if (!t.startsWith('Bearer ')) t = `Bearer ${t}`; headers['Authorization'] = t; } } catch(_) {}
    headers['Content-Type'] = 'application/json';
    return headers;
  }

  function toast(msg, type='ok') {
    const box = el('settings-toast'); if (!box) return;
    const d = document.createElement('div');
    d.className = type==='err' ? 'px-4 py-2 rounded-md shadow-sm bg-rose-50 border border-rose-200 text-rose-700' : 'px-4 py-2 rounded-md shadow-sm bg-emerald-50 border border-emerald-200 text-emerald-700';
    d.textContent = msg; box.appendChild(d); setTimeout(()=>d.remove(), 3000);
  }

  let initial = null;
  function currentValues() {
    return {
      company_name: el('company-name')?.value.trim() || null,
      address: el('address')?.value.trim() || null,
      currency: el('currency')?.value || 'INR',
      email_updates: !!el('notif-email')?.checked,
      sms_alerts: !!el('notif-sms')?.checked,
      low_stock_reminders: !!el('notif-lowstock')?.checked,
      // Local-only preferences
      orders_page_size: Number(el('orders-page-size')?.value || '') || null,
      orders_group_default: !!el('orders-group-default')?.checked,
      date_format: el('date-format')?.value || null,
      time_format: el('time-format')?.value || null,
      // Receipt settings (local only)
      rc_title: el('rc-title')?.value.trim() || null,
      rc_subtitle: el('rc-subtitle')?.value.trim() || null,
      rc_address: el('rc-address')?.value.trim() || null,
      rc_phone: el('rc-phone')?.value.trim() || null,
      rc_gstin: el('rc-gstin')?.value.trim() || null,
      rc_footer1: el('rc-footer1')?.value.trim() || null,
      rc_footer2: el('rc-footer2')?.value.trim() || null,
      rc_show_tax: !!el('rc-show-tax')?.checked,
      rc_copies: Number(el('rc-copies')?.value || '') || null,
      rc_paper: el('rc-paper')?.value || null,
    };
  }

  function dirtyCheck() {
    if (!initial) return false;
    const cur = currentValues();
    return Object.keys(initial).some(k => {
      const a = initial[k]; const b = cur[k];
      return (a ?? null) !== (b ?? null);
    });
  }

  function updateDirtyBar() {
    const bar = el('settings-dirty-bar'); if (!bar) return;
    if (dirtyCheck()) bar.classList.remove('hidden'); else bar.classList.add('hidden');
  }

  async function loadSettings() {
    try {
      const res = await fetch(baseUrl + '/settings', { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const s = await res.json();
      el('company-name') && (el('company-name').value = s.company_name || '');
      el('address') && (el('address').value = s.address || '');
      if (el('currency')) { el('currency').value = s.currency || 'INR'; }
      if (el('notif-email')) el('notif-email').checked = !!s.email_updates;
      if (el('notif-sms')) el('notif-sms').checked = !!s.sms_alerts;
      if (el('notif-lowstock')) el('notif-lowstock').checked = !!s.low_stock_reminders;
      // Load local preferences
      let prefs = {};
      try { prefs = JSON.parse(localStorage.getItem('IF_PREFS') || '{}'); } catch(_) {}
      if (el('orders-page-size')) el('orders-page-size').value = String(prefs.orders_page_size || 10);
      if (el('orders-group-default')) el('orders-group-default').checked = !!prefs.orders_group_default;
      if (el('date-format')) el('date-format').value = prefs.date_format || 'dd MMM yyyy';
      if (el('time-format')) el('time-format').value = prefs.time_format || '12';
      // Load receipt settings from localStorage
      let rcs = {};
      try { rcs = JSON.parse(localStorage.getItem('IF_RECEIPT_SETTINGS') || '{}'); } catch(_) {}
      if (el('rc-title')) el('rc-title').value = rcs.title || '';
      if (el('rc-subtitle')) el('rc-subtitle').value = rcs.subtitle || '';
      if (el('rc-address')) el('rc-address').value = rcs.address || '';
      if (el('rc-phone')) el('rc-phone').value = rcs.phone || '';
      if (el('rc-gstin')) el('rc-gstin').value = rcs.gstin || '';
      if (el('rc-footer1')) el('rc-footer1').value = rcs.footer1 || 'Thank you for your purchase!';
      if (el('rc-footer2')) el('rc-footer2').value = rcs.footer2 || 'Powered by InvoiceFlow';
      if (el('rc-show-tax')) el('rc-show-tax').checked = !!rcs.show_tax;
      if (el('rc-copies')) el('rc-copies').value = String(rcs.copies || 2);
      if (el('rc-paper')) el('rc-paper').value = rcs.paper || '80';
      initial = currentValues();
      updateDirtyBar();
    } catch (e) {
      console.error('Settings load failed', e);
      toast('Failed to load settings', 'err');
    }
  }

  async function saveSettings() {
    try {
      const payload = currentValues();
      const serverPayload = {
        company_name: payload.company_name,
        address: payload.address,
        currency: payload.currency || 'INR',
        email_updates: !!payload.email_updates,
        sms_alerts: !!payload.sms_alerts,
        low_stock_reminders: !!payload.low_stock_reminders,
      };
      const res = await fetch(baseUrl + '/settings', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(serverPayload) });
      if (!res.ok) throw new Error(await res.text());
      const s = await res.json();
      initial = {
        company_name: s.company_name || null,
        address: s.address || null,
        currency: s.currency || 'INR',
        email_updates: !!s.email_updates,
        sms_alerts: !!s.sms_alerts,
        low_stock_reminders: !!s.low_stock_reminders,
        orders_page_size: Number(el('orders-page-size')?.value || '') || null,
        orders_group_default: !!el('orders-group-default')?.checked,
        date_format: el('date-format')?.value || null,
        time_format: el('time-format')?.value || null,
        rc_title: payload.rc_title || null,
        rc_subtitle: payload.rc_subtitle || null,
        rc_address: payload.rc_address || null,
        rc_phone: payload.rc_phone || null,
        rc_gstin: payload.rc_gstin || null,
        rc_footer1: payload.rc_footer1 || null,
        rc_footer2: payload.rc_footer2 || null,
        rc_show_tax: !!payload.rc_show_tax,
        rc_copies: payload.rc_copies || null,
        rc_paper: payload.rc_paper || null,
      };
      const prefsToSave = {
        orders_page_size: initial.orders_page_size || 10,
        orders_group_default: initial.orders_group_default || false,
        date_format: initial.date_format || 'dd MMM yyyy',
        time_format: initial.time_format || '12',
      };
      localStorage.setItem('IF_PREFS', JSON.stringify(prefsToSave));
      // Save receipt settings locally
      const receiptToSave = {
        title: payload.rc_title || '',
        subtitle: payload.rc_subtitle || '',
        address: payload.rc_address || '',
        phone: payload.rc_phone || '',
        gstin: payload.rc_gstin || '',
        footer1: payload.rc_footer1 || 'Thank you for your purchase!',
        footer2: payload.rc_footer2 || 'Powered by InvoiceFlow',
        show_tax: !!payload.rc_show_tax,
        copies: Math.min(Math.max(payload.rc_copies || 2, 1), 5),
        paper: (payload.rc_paper === '58' ? '58' : '80'),
      };
      localStorage.setItem('IF_RECEIPT_SETTINGS', JSON.stringify(receiptToSave));
      updateDirtyBar();
      toast('Settings saved');
    } catch (e) {
      console.error('Settings save failed', e);
      toast('Failed to save settings', 'err');
    }
  }

  function discardChanges() {
    if (!initial) return;
    el('company-name') && (el('company-name').value = initial.company_name || '');
    el('address') && (el('address').value = initial.address || '');
    if (el('currency')) el('currency').value = initial.currency || 'INR';
    if (el('notif-email')) el('notif-email').checked = !!initial.email_updates;
    if (el('notif-sms')) el('notif-sms').checked = !!initial.sms_alerts;
    if (el('notif-lowstock')) el('notif-lowstock').checked = !!initial.low_stock_reminders;
    if (el('orders-page-size')) el('orders-page-size').value = String(initial.orders_page_size || 10);
    if (el('orders-group-default')) el('orders-group-default').checked = !!initial.orders_group_default;
    if (el('date-format')) el('date-format').value = initial.date_format || 'dd MMM yyyy';
    if (el('time-format')) el('time-format').value = initial.time_format || '12';
    if (el('rc-title')) el('rc-title').value = initial.rc_title || '';
    if (el('rc-subtitle')) el('rc-subtitle').value = initial.rc_subtitle || '';
    if (el('rc-address')) el('rc-address').value = initial.rc_address || '';
    if (el('rc-phone')) el('rc-phone').value = initial.rc_phone || '';
    if (el('rc-gstin')) el('rc-gstin').value = initial.rc_gstin || '';
    if (el('rc-footer1')) el('rc-footer1').value = initial.rc_footer1 || 'Thank you for your purchase!';
    if (el('rc-footer2')) el('rc-footer2').value = initial.rc_footer2 || 'Powered by InvoiceFlow';
    if (el('rc-show-tax')) el('rc-show-tax').checked = !!initial.rc_show_tax;
    if (el('rc-copies')) el('rc-copies').value = String(initial.rc_copies || 2);
    if (el('rc-paper')) el('rc-paper').value = initial.rc_paper || '80';
    updateDirtyBar();
  }

  function wireInputs() {
    ['company-name','address','currency','notif-email','notif-sms','notif-lowstock','orders-page-size','orders-group-default','date-format','time-format','rc-title','rc-subtitle','rc-address','rc-phone','rc-gstin','rc-footer1','rc-footer2','rc-show-tax','rc-copies','rc-paper'].forEach(id => {
      const e = el(id); if (!e) return;
      e.addEventListener('input', updateDirtyBar);
      e.addEventListener('change', updateDirtyBar);
    });
    el('settings-save')?.addEventListener('click', saveSettings);
    el('settings-discard')?.addEventListener('click', discardChanges);
  }

  function init(){
    wireInputs();
    loadSettings();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
