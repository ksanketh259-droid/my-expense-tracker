// Login, register, forgot password and reset password pages.
(function () {
  const page = document.body.dataset.page;
  const form = document.getElementById('authForm');
  const alertBox = document.getElementById('alert');
  const submitBtn = document.getElementById('submitBtn');

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = 'alert alert-' + (type || 'error');
    alertBox.classList.remove('hidden');
  }
  function clearAlert() { alertBox.classList.add('hidden'); }
  function setBusy(busy, label) {
    submitBtn.disabled = busy;
    submitBtn.innerHTML = '';
    if (busy) {
      const s = document.createElement('span');
      s.className = 'spinner';
      submitBtn.appendChild(s);
      submitBtn.appendChild(document.createTextNode(' Please wait...'));
    } else {
      submitBtn.textContent = label;
    }
  }
  function fieldError(id, message) {
    const input = document.getElementById(id);
    const err = document.getElementById(id + 'Error');
    if (message) { input.classList.add('invalid'); if (err) err.textContent = message; }
    else { input.classList.remove('invalid'); if (err) err.textContent = ''; }
  }
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const originUrl = (file) => window.location.origin + '/' + file;

  async function start() {
    let client;
    try { client = await initSupabase(); }
    catch (e) { showAlert(e.message); submitBtn.disabled = true; return; }

    // Already logged in? Skip straight to the dashboard (not on the reset page).
    if (page !== 'reset') {
      const session = await getSession();
      if (session) { window.location.href = 'dashboard.html'; return; }
    }

    if (page === 'reset') {
      // Supabase puts the recovery token in the link; it signs the user in temporarily.
      submitBtn.disabled = true;
      client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') submitBtn.disabled = false;
      });
      const s = await getSession();
      if (s) submitBtn.disabled = false;
      else showAlert('Open this page from the link in your reset email.', 'error');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();
      const email = form.email ? form.email.value.trim() : '';
      const password = form.password ? form.password.value : '';

      if (page === 'login') {
        fieldError('email'); fieldError('password');
        let bad = false;
        if (!emailOk(email)) { fieldError('email', 'Enter a valid email address.'); bad = true; }
        if (!password) { fieldError('password', 'Enter your password.'); bad = true; }
        if (bad) return;
        setBusy(true);
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          setBusy(false, 'Log in');
          showAlert(error.message === 'Email not confirmed'
            ? 'Please verify your email first. Check your inbox for the confirmation link.'
            : 'Incorrect email or password.');
          return;
        }
        window.location.href = 'dashboard.html';
      }

      if (page === 'register') {
        fieldError('email'); fieldError('password'); fieldError('confirm');
        let bad = false;
        if (!emailOk(email)) { fieldError('email', 'Enter a valid email address.'); bad = true; }
        if (password.length < 8) { fieldError('password', 'Use at least 8 characters.'); bad = true; }
        if (form.confirm.value !== password) { fieldError('confirm', 'Passwords do not match.'); bad = true; }
        if (bad) return;
        setBusy(true);
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { emailRedirectTo: originUrl('login.html') }
        });
        if (error) { setBusy(false, 'Create account'); showAlert(error.message); return; }
        if (data.session) { window.location.href = 'dashboard.html'; return; }
        setBusy(false, 'Create account');
        form.reset();
        showAlert('Account created. Check your email and click the verification link, then log in.', 'success');
      }

      if (page === 'forgot') {
        fieldError('email');
        if (!emailOk(email)) { fieldError('email', 'Enter a valid email address.'); return; }
        setBusy(true);
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: originUrl('reset-password.html') });
        setBusy(false, 'Send reset link');
        if (error) { showAlert(error.message); return; }
        showAlert('If that email has an account, a reset link is on its way.', 'success');
      }

      if (page === 'reset') {
        fieldError('password'); fieldError('confirm');
        let bad = false;
        if (password.length < 8) { fieldError('password', 'Use at least 8 characters.'); bad = true; }
        if (form.confirm.value !== password) { fieldError('confirm', 'Passwords do not match.'); bad = true; }
        if (bad) return;
        setBusy(true);
        const { error } = await client.auth.updateUser({ password });
        if (error) { setBusy(false, 'Update password'); showAlert(error.message); return; }
        await client.auth.signOut();
        setBusy(false, 'Update password');
        showAlert('Password updated. Redirecting to login...', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      }
    });
  }

  start();
})();
