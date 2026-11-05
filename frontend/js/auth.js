
// Login, register, forgot password and reset password pages.
(function () {
  'use strict';

  const page = document.body.dataset.page;
  const form = document.getElementById('authForm');
  const alertBox = document.getElementById('alert');
  const submitBtn = document.getElementById('submitBtn');

  function showAlert(message, type = 'error') {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = 'alert alert-' + type;
    alertBox.classList.remove('hidden');
  }

  function clearAlert() {
    if (alertBox) alertBox.classList.add('hidden');
  }

  function setBusy(busy, label) {
    if (!submitBtn) return;

    submitBtn.disabled = busy;
    submitBtn.innerHTML = '';

    if (busy) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      submitBtn.appendChild(spinner);
      submitBtn.appendChild(
        document.createTextNode(' Please wait...')
      );
    } else {
      submitBtn.textContent = label;
    }
  }

  function fieldError(id, message = '') {
    const input = document.getElementById(id);
    const errorElement = document.getElementById(id + 'Error');

    if (input) {
      input.classList.toggle('invalid', Boolean(message));
    }

    if (errorElement) {
      errorElement.textContent = message;
    }
  }

  const emailOk = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // Works correctly on GitHub Pages project URLs.
  // Example:
  // /my-expense-tracker/login.html
  const originUrl = (file) =>
    new URL(file, window.location.href).href;

  async function start() {
    if (!form || !submitBtn || !alertBox) {
      console.error('Authentication page elements are missing.');
      return;
    }

    let client;

    try {
      client = await initSupabase();
    } catch (error) {
      showAlert(error.message || 'Could not connect to Supabase.');
      submitBtn.disabled = true;
      return;
    }

    // Redirect logged-in users to dashboard.
    if (page !== 'reset') {
      try {
        const session = await getSession();

        if (session) {
          window.location.href = 'dashboard.html';
          return;
        }
      } catch (error) {
        showAlert(error.message);
        return;
      }
    }

    // Password recovery page.
    if (page === 'reset') {
      submitBtn.disabled = true;

      client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          submitBtn.disabled = false;
          clearAlert();
        }
      });

      const session = await getSession();

      if (session) {
        submitBtn.disabled = false;
      } else {
        showAlert(
          'Open this page using the password reset link sent to your email.'
        );
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearAlert();

      const email = form.email
        ? form.email.value.trim()
        : '';

      const password = form.password
        ? form.password.value
        : '';

      // LOGIN
      if (page === 'login') {
        fieldError('email');
        fieldError('password');

        let invalid = false;

        if (!emailOk(email)) {
          fieldError('email', 'Enter a valid email address.');
          invalid = true;
        }

        if (!password) {
          fieldError('password', 'Enter your password.');
          invalid = true;
        }

        if (invalid) return;

        setBusy(true);

        try {
          const { error } =
            await client.auth.signInWithPassword({
              email,
              password
            });

          if (error) {
            setBusy(false, 'Log in');

            showAlert(
              error.message === 'Email not confirmed'
                ? 'Please verify your email first. Check your inbox.'
                : 'Incorrect email or password.'
            );

            return;
          }

          window.location.href = 'dashboard.html';

        } catch (error) {
          setBusy(false, 'Log in');
          showAlert(error.message);
        }
      }

      // REGISTER
      if (page === 'register') {
        fieldError('email');
        fieldError('password');
        fieldError('confirm');

        let invalid = false;

        if (!emailOk(email)) {
          fieldError('email', 'Enter a valid email address.');
          invalid = true;
        }

        if (password.length < 8) {
          fieldError('password', 'Use at least 8 characters.');
          invalid = true;
        }

        if (
          !form.confirm ||
          form.confirm.value !== password
        ) {
          fieldError('confirm', 'Passwords do not match.');
          invalid = true;
        }

        if (invalid) return;

        setBusy(true);

        try {
          const { data, error } =
            await client.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: originUrl('login.html')
              }
            });

          if (error) {
            setBusy(false, 'Create account');
            showAlert(error.message);
            return;
          }

          if (data.session) {
            window.location.href = 'dashboard.html';
            return;
          }

          setBusy(false, 'Create account');
          form.reset();

          showAlert(
            'Account created! Check your email and verify your account before logging in.',
            'success'
          );

        } catch (error) {
          setBusy(false, 'Create account');
          showAlert(error.message);
        }
      }

      // FORGOT PASSWORD
      if (page === 'forgot') {
        fieldError('email');

        if (!emailOk(email)) {
          fieldError('email', 'Enter a valid email address.');
          return;
        }

        setBusy(true);

        try {
          const { error } =
            await client.auth.resetPasswordForEmail(email, {
              redirectTo: originUrl('reset-password.html')
            });

          setBusy(false, 'Send reset link');

          if (error) {
            showAlert(error.message);
            return;
          }

          showAlert(
            'If this email has an account, a password reset link is on its way.',
            'success'
          );

        } catch (error) {
          setBusy(false, 'Send reset link');
          showAlert(error.message);
        }
      }

      // RESET PASSWORD
      if (page === 'reset') {
        fieldError('password');
        fieldError('confirm');

        let invalid = false;

        if (password.length < 8) {
          fieldError('password', 'Use at least 8 characters.');
          invalid = true;
        }

        if (
          !form.confirm ||
          form.confirm.value !== password
        ) {
          fieldError('confirm', 'Passwords do not match.');
          invalid = true;
        }

        if (invalid) return;

        setBusy(true);

        try {
          const { error } =
            await client.auth.updateUser({ password });

          if (error) {
            setBusy(false, 'Update password');
            showAlert(error.message);
            return;
          }

          await client.auth.signOut();

          setBusy(false, 'Update password');

          showAlert(
            'Password updated successfully. Redirecting to login...',
            'success'
          );

          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1500);

        } catch (error) {
          setBusy(false, 'Update password');
          showAlert(error.message);
        }
      }
    });
  }

  start();
})();
