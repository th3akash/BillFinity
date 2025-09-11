(() => {
  const baseUrl = 'http://127.0.0.1:8000';

  function setError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  async function signIn(email, password) {
    // FastAPI endpoint expects query params for simple args
    const url = new URL(baseUrl + '/users/login');
    url.searchParams.set('email', email);
    url.searchParams.set('password', password);
    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Login failed (${res.status})`);
    }
    const data = await res.json();
    const token = data && (data.access_token || data.token || data?.data?.access_token);
    if (!token) throw new Error('No token in response');
    // Store with Bearer prefix so all pages work
    const store = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    localStorage.setItem('IF_TOKEN', store);
    try { localStorage.IF_TOKEN = store; } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('login-submit');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) { setError('Email and password are required'); return; }
      try {
        submitBtn.disabled = true; submitBtn.textContent = 'Signing in…';
        await signIn(email, password);
        window.location.href = 'index.html';
      } catch (err) {
        setError(String(err?.message || err));
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = 'Sign In';
      }
    });
  });
})();
