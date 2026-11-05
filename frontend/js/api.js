// Shared helpers: Supabase client + calls to our Express API.
let supa = null;

async function initSupabase() {
  if (supa) return supa;
  const res = await fetch('/api/config');
  const cfg = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cfg.error || 'Could not load app settings.');
  supa = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return supa;
}

async function getSession() {
  const client = await initSupabase();
  const { data } = await client.auth.getSession();
  return data.session;
}

// Use on protected pages: sends visitors who are not logged in to the login page.
async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function api(path, options = {}) {
  const client = await initSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session && data.session.access_token;
  if (!token) {
    window.location.href = 'login.html';
    throw new Error('Please log in.');
  }
  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await client.auth.signOut();
    window.location.href = 'login.html';
    throw new Error(body.error || 'Please log in again.');
  }
  if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}
