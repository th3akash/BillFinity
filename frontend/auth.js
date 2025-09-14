(function(){
  const baseUrl = 'http://127.0.0.1:8000';
  const el = (id)=>document.getElementById(id);
  const title = el('auth-title');
  const toggle = el('toggle-mode');
  const form = el('auth-form');
  const nameField = el('name-field');
  const termsField = el('terms-field');
  const toastBox = el('auth-toast');
  const password = el('password');
  const togglePw = el('toggle-password');

  // Google OAuth button
  const oauthGoogle = el('oauth-google');

  // Consent modal elements
  const consentBackdrop = el('consent-backdrop');
  const consentCheckbox = el('consent-checkbox');
  const consentCancel = el('consent-cancel');
  const consentAccept = el('consent-accept');

  let mode = 'signin'; // 'signin' | 'signup'
  let consentGiven = false;

  function toast(msg, type='ok'){
    const d = document.createElement('div');
    d.className = type==='err'
      ? 'px-4 py-2 rounded-md shadow-sm bg-rose-50 border border-rose-200 text-rose-700 text-sm'
      : 'px-4 py-2 rounded-md shadow-sm bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm';
    d.textContent = msg;
    toastBox.appendChild(d);
    setTimeout(()=>d.remove(), 3500);
  }

  function setMode(next){
    mode = next;
    if (mode === 'signup'){
      title.textContent = 'Create your account';
      toggle.textContent = 'Have an account? Sign in';
      nameField.classList.remove('hidden');
      termsField.classList.remove('hidden');
    } else {
      title.textContent = 'Sign in';
      toggle.textContent = 'Create account';
      nameField.classList.add('hidden');
      termsField.classList.add('hidden');
    }
  }

  // Open consent dialog helper
  function openConsent(){
    consentBackdrop.style.display = 'flex';
    consentCheckbox.checked = false;
    consentAccept.disabled = true;
  }
  function closeConsent(){
    consentBackdrop.style.display = 'none';
  }

  // Toggle between signin/signup — show consent before switching to signup if not already given
  toggle.addEventListener('click', () => {
    if (mode === 'signin'){
      if (!consentGiven){
        openConsent();
        return; // Wait until accepted; then we'll switch modes
      }
      setMode('signup');
    } else {
      setMode('signin');
    }
  });

  // Consent modal interactions
  consentCheckbox.addEventListener('change', () => {
    consentAccept.disabled = !consentCheckbox.checked;
  });
  consentCancel.addEventListener('click', () => {
    closeConsent();
  });
  consentAccept.addEventListener('click', () => {
    consentGiven = true;
    closeConsent();
    setMode('signup');
    toast('Privacy Policy consent recorded');
  });

  // Show/Hide password
  togglePw.addEventListener('click', () => {
    if (password.type === 'password'){ password.type = 'text'; togglePw.textContent = 'Hide'; }
    else { password.type = 'password'; togglePw.textContent = 'Show'; }
  });

  // Social OAuth (placeholder endpoint)
  oauthGoogle.addEventListener('click', () => {
    // Replace with your real Google OAuth authorization endpoint
    // e.g., window.location.href = baseUrl + '/auth/google';
    toast('Redirecting to Google OAuth…');
    window.location.href = baseUrl + '/auth/google'; // placeholder
  });

  async function signup(payload){
    const res = await fetch(baseUrl + '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function signin(payload){
    const res = await fetch(baseUrl + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = (document.getElementById('email').value || '').trim();
    const pass = (document.getElementById('password').value || '').trim();
    const name = (document.getElementById('name')?.value || '').trim();
    const remember = !!document.getElementById('remember')?.checked;
    const terms = !!document.getElementById('terms')?.checked;

    if (!email || !pass) { toast('Email and password are required', 'err'); return; }

    try {
      if (mode==='signup'){
        if (!consentGiven){ openConsent(); return; }
        if (!name){ toast('Please enter your full name', 'err'); return; }
        if (!terms){ toast('Please accept the Privacy Policy and Terms', 'err'); return; }
        await signup({ name, email, password: pass });
        toast('Account created. You can sign in now.');
        setMode('signin');
        return;
      }

      const data = await signin({ email, password: pass });
      const token = data?.access_token;
      if (!token) throw new Error('Invalid response: no access_token');

      const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      try { localStorage.setItem('IF_TOKEN', bearer); } catch(_) {}
      if (remember){ try { localStorage.setItem('IF_LAST_EMAIL', email); } catch(_) {} }

      toast('Signed in successfully');
      setTimeout(()=>{ window.location.href = 'index.html'; }, 600);
    } catch (err){
      console.error(err);
      toast('Authentication failed', 'err');
    }
  });

  // Prefill last email if available
  try {
    const last = localStorage.getItem('IF_LAST_EMAIL');
    if (last) document.getElementById('email').value = last;
  } catch(_) {}
})();