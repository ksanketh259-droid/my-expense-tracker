require('dotenv').config();
const express = require('express');
const cors = require('cors');

const transactionsRouter = require('./routes/transactions');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50kb' }));

// Simple check that the server is alive.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// The frontend asks for these two values when a page loads.
// Both are PUBLIC values. The secret service_role key is never used here.
app.get('/api/config', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server is missing Supabase settings. Check your .env file.' });
  }
  res.json({ supabaseUrl, supabaseAnonKey });
});

app.use('/api/transactions', transactionsRouter);

// Unknown API route
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Last-resort error handler (does not leak internal details)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = app;
