const baseUrl = 'http://127.0.0.1:8000';

const totalSalesEl = document.getElementById('total-sales');
const totalCustomersEl = document.getElementById('total-customers');
const ordersCompletedEl = document.getElementById('orders-completed');
const ordersCancelledEl = document.getElementById('orders-cancelled');

async function fetchAndUpdateMetrics() {
  try {
    const token = localStorage.IF_TOKEN;
    // Fetch orders and customers in parallel
    const [ordersRes, customersRes] = await Promise.all([
      fetch(baseUrl + '/orders', { headers: { 'Authorization': token } }),
      fetch(baseUrl + '/customers', { headers: { 'Authorization': token } })
    ]);

    if (!ordersRes.ok) throw new Error('Orders fetch failed: ' + await ordersRes.text());
    if (!customersRes.ok) throw new Error('Customers fetch failed: ' + await customersRes.text());

    const orders = await ordersRes.json();
    const customers = await customersRes.json();

    // Compute totals
    let totalSales = 0;
    let completed = 0;
    let cancelled = 0;

    if (Array.isArray(orders)) {
      for (const o of orders) {
        const t = parseFloat(o.total || o.amount || 0);
        if (!Number.isNaN(t)) totalSales += t;
        const st = (o.status || '').toString().toLowerCase();
        if (st.includes('complete')) completed += 1;
        if (st.includes('cancel')) cancelled += 1;
      }
    }

    // Update DOM (format rupee)
    if (totalSalesEl) totalSalesEl.textContent = '\u20b9' + totalSales.toFixed(2);
    if (totalCustomersEl) totalCustomersEl.textContent = (Array.isArray(customers) ? customers.length : '0');
    if (ordersCompletedEl) ordersCompletedEl.textContent = completed;
    if (ordersCancelledEl) ordersCancelledEl.textContent = cancelled;

    // Top selling: compute simple counts from order.items
    try {
      const topListEl = document.getElementById('top-selling-list');
      if (topListEl && Array.isArray(orders)) {
        const counts = new Map();
        for (const o of orders) {
          if (!Array.isArray(o.items)) continue;
          for (const it of o.items) {
            const name = (it.name || it.title || it.item_name || it.sku || 'Unknown');
            const qty = Number(it.quantity || it.qty || it.count || 1) || 1;
            counts.set(name, (counts.get(name) || 0) + qty);
          }
        }
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const top3 = sorted.slice(0, 3);
        if (top3.length === 0) {
          topListEl.innerHTML = '<div class="text-sm text-slate-500">No product data</div>';
        } else {
          const totalQty = top3.reduce((s, [, q]) => s + q, 0);
          topListEl.innerHTML = top3.map(([name, q]) => {
            const pct = totalQty > 0 ? Math.round((q / totalQty) * 100) : 0;
            const color = pct >= 50 ? 'bg-brand-500' : pct >= 20 ? 'bg-emerald-500' : 'bg-amber-400';
            return `
              <div>
                <div class="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>${name}</span><span>${pct}%</span>
                </div>
                <div class="mt-2 h-2 w-full rounded-full bg-slate-100">
                  <div class="h-2 rounded-full ${color}" style="width:${pct}%"></div>
                </div>
              </div>`;
          }).join('');
        }
      }
    } catch (e) {
      // ignore render errors
    }
  } catch (err) {
    // Silent failure: keep existing values, but log for debugging
    console.error('dashboard metrics error', err);
  }
}

fetchAndUpdateMetrics();

// Refresh when orders websocket sends updates
try {
  const ws = new WebSocket('ws://127.0.0.1:8000/ws/orders');
  ws.addEventListener('message', ev => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg && msg.type === 'order_update') {
        fetchAndUpdateMetrics();
      }
    } catch (e) { }
  });
  ws.addEventListener('error', () => { /* ignore */ });
} catch (e) { /* ignore */ }

// Optional: refresh every 60s as fallback
setInterval(fetchAndUpdateMetrics, 60000);
