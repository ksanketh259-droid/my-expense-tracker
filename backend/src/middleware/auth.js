const { createClient } = require('@supabase/supabase-js');

// Checks the login token sent by the browser.
// 1. Reads "Authorization: Bearer <token>".
// 2. Asks Supabase if the token is valid and who it belongs to.
// 3. Creates a Supabase client that acts AS THAT USER, so the database
//    Row Level Security rules apply to every query.
module.exports = async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Please log in first.' });
    }

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error } = await db.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }

    req.user = data.user; // the real user, verified by Supabase
    req.db = db;          // database client that runs as this user
    next();
  } catch (err) {
    next(err);
  }
};
