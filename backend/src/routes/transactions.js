const express = require('express');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const CATEGORIES = ['Food', 'Transport', 'Education', 'Shopping', 'Healthcare', 'Bills', 'Entertainment', 'Other'];
const METHODS = ['Cash', 'UPI', 'Card', 'Net Banking', 'Other'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Checks the data sent by the browser. Never trusts it blindly.
// Note: user_id is NOT read from the request. It comes from the verified login.
function validate(body) {
  const errors = [];
  const b = body || {};

  if (!['income', 'expense'].includes(b.type)) errors.push('Type must be income or expense.');

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999) {
    errors.push('Amount must be a number greater than 0.');
  }

  const description = String(b.description || '').trim();
  if (!description) errors.push('Description is required.');
  if (description.length > 120) errors.push('Description must be 120 characters or less.');

  if (!CATEGORIES.includes(b.category)) errors.push('Please choose a valid category.');
  if (!METHODS.includes(b.payment_method)) errors.push('Please choose a valid payment method.');
  if (!isRealDate(String(b.transaction_date || ''))) errors.push('Please enter a valid date.');

  const notes = String(b.notes || '').trim();
  if (notes.length > 500) errors.push('Notes must be 500 characters or less.');

  return {
    errors,
    value: {
      type: b.type,
      amount: Math.round(amount * 100) / 100,
      category: b.category,
      description,
      transaction_date: b.transaction_date,
      payment_method: b.payment_method,
      notes: notes || null
    }
  };
}

// GET /api/transactions?search=&type=&category=&from=&to=&month=YYYY-MM
router.get('/', async (req, res, next) => {
  try {
    const { search, type, category, from, to, month } = req.query;

    let query = req.db
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (type && ['income', 'expense'].includes(type)) query = query.eq('type', type);
    if (category && CATEGORIES.includes(category)) query = query.eq('category', category);
    if (search && String(search).trim()) query = query.ilike('description', `%${String(search).trim().slice(0, 100)}%`);

    if (month && MONTH_RE.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      query = query.gte('transaction_date', `${month}-01`).lte('transaction_date', last);
    } else {
      if (from && isRealDate(from)) query = query.gte('transaction_date', from);
      if (to && isRealDate(to)) query = query.lte('transaction_date', to);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ transactions: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions
router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validate(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { data, error } = await req.db
      .from('transactions')
      .insert({ ...value, user_id: req.user.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ transaction: data });
  } catch (err) {
    next(err);
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id.' });
    const { errors, value } = validate(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    // RLS makes sure only the owner's row can be updated.
    const { data, error } = await req.db
      .from('transactions')
      .update(value)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ transaction: data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id.' });

    // RLS makes sure only the owner's row can be deleted.
    const { data, error } = await req.db
      .from('transactions')
      .delete()
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
