
// Shared helpers: Supabase client + Express API calls.

let supa = null;

// IMPORTANT:
// Replace this URL after deploying your backend.
// Example: https://my-expense-api.onrender.com
const BACKEND_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://YOUR-BACKEND-URL';

const API_BASE_URL = BACKEND_URL.replace(/\/+$/, '');

// Initialize Supabase using backend configuration.
async function initSupabase() {
  if (supa) return supa;

  const res = await fetch(`${API_BASE_URL}/api/config`);

  const cfg = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      cfg.error || 'Could not load app settings.'
    );
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('Supabase configuration is missing.');
  }

  if (!window.supabase) {
    throw new Error('Supabase library is not loaded.');
  }

  supa = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey
  );

  return supa;
}

// Get current logged-in session.
async function getSession() {
  const client = await initSupabase();

  const { data, error } = await client.auth.getSession();

  if (error) throw error;

  return data.session;
}

// Protect dashboard and other private pages.
async function requireSession() {
  const session = await getSession();

  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  return session;
}

// Common Express API helper.
async function api(path, options = {}) {
  const client = await initSupabase();

  const { data, error } = await client.auth.getSession();

  if (error) throw error;

  const token = data.session?.access_token;

  if (!token) {
    window.location.href = 'login.html';
    throw new Error('Please log in.');
  }

  const res = await fetch(
    `${API_BASE_URL}/api${path}`,
    {
      method: options.method || 'GET',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },

      body: options.body
        ? JSON.stringify(options.body)
        : undefined
    }
  );

  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    await client.auth.signOut();
    window.location.href = 'login.html';

    throw new Error(
      body.error || 'Please log in again.'
    );
  }

  if (!res.ok) {
    throw new Error(
      body.error || 'Something went wrong. Please try again.'
    );
  }

  return body;
}
