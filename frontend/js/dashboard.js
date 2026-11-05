// Dashboard page logic: loads transactions, draws cards/charts/tables,
// handles add/edit/delete, filters, reports, CSV and print.
(function () {
  const CATEGORIES = ['Food', 'Transport', 'Education', 'Shopping', 'Healthcare', 'Bills', 'Entertainment', 'Other'];
  const METHODS = ['Cash', 'UPI', 'Card', 'Net Banking', 'Other'];
  const TITLES = { dashboard: 'Dashboard', transactions: 'Transactions', reports: 'Reports', profile: 'Profile' };
  const CAT_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

  const $ = (id) => document.getElementById(id);
  const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n) || 0);

  let session = null;
  let all = [];            // every transaction (for dashboard + reports)
  let editingId = null;    // id being edited, or null when adding
  let deleteId = null;     // id waiting for delete confirmation
  let currentView = 'dashboard';
  const charts = {};

  // ---------- small helpers ----------
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function todayStr() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function monthKey(dateStr) { return String(dateStr).slice(0, 7); }
  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  function dateLabel(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  let toastTimer;
  function toast(message, isError) {
    const t = $('toast');
    t.textContent = message;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 3200);
  }
  function setLoading(on) { $('loading').classList.toggle('hidden', !on); }
  function showPageError(msg) {
    const box = $('pageError');
    box.textContent = msg || '';
    box.classList.toggle('hidden', !msg);
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // ---------- navigation ----------
  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    $('view-' + name).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach((b) => {
      const active = b.dataset.view === name;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('pageTitle').textContent = TITLES[name];
    closeMenu();
    if (name === 'dashboard') renderDashboard();
    if (name === 'transactions') loadTransactions();
    if (name === 'reports') renderReports();
    if (name === 'profile') renderProfile();
  }
  function openMenu() { $('sidebar').classList.add('open'); $('overlay').classList.add('show'); $('menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeMenu() { $('sidebar').classList.remove('open'); $('overlay').classList.remove('show'); $('menuBtn').setAttribute('aria-expanded', 'false'); }

  // ---------- data ----------
  async function loadAll() {
    setLoading(true);
    showPageError('');
    try {
      const data = await api('/transactions');
      all = data.transactions.map((t) => ({ ...t, amount: Number(t.amount) }));
    } catch (e) {
      showPageError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function refresh() {
    await loadAll();
    refreshReportMonths();
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'transactions') await loadTransactions();
    if (currentView === 'reports') renderReports();
    if (currentView === 'profile') renderProfile();
  }

  // ---------- dashboard ----------
  function totals(list) {
    let income = 0, expense = 0;
    list.forEach((t) => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
    return { income, expense, balance: income - expense };
  }

  function amountCell(t) {
    const td = el('td', 'num ' + (t.type === 'income' ? 'amt-income' : 'amt-expense'),
      (t.type === 'income' ? '+ ' : '- ') + money(t.amount));
    return td;
  }
  function typeBadge(t) { return el('span', 'badge badge-' + t.type, t.type === 'income' ? 'Income' : 'Expense'); }

  function renderDashboard() {
    const t = totals(all);
    $('sBalance').textContent = money(t.balance);
    $('sIncome').textContent = money(t.income);
    $('sExpense').textContent = money(t.expense);
    const thisMonth = monthKey(todayStr());
    const monthSpend = all.filter((x) => x.type === 'expense' && monthKey(x.transaction_date) === thisMonth)
      .reduce((s, x) => s + x.amount, 0);
    $('sMonth').textContent = money(monthSpend);

    const body = $('recentBody');
    body.replaceChildren();
    const recent = all.slice(0, 6);
    $('recentEmpty').classList.toggle('hidden', recent.length > 0);
    recent.forEach((tx) => {
      const tr = el('tr');
      tr.appendChild(el('td', '', dateLabel(tx.transaction_date)));
      tr.appendChild(el('td', '', tx.description));
      const c = el('td'); c.appendChild(el('span', 'badge badge-cat', tx.category)); tr.appendChild(c);
      const ty = el('td'); ty.appendChild(typeBadge(tx)); tr.appendChild(ty);
      tr.appendChild(amountCell(tx));
      body.appendChild(tr);
    });
    drawCharts();
  }

  function last6Months() {
    const keys = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      keys.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'));
    }
    return keys;
  }

  function drawCharts() {
    if (typeof Chart === 'undefined') return;
    const textColor = css('--muted');
    const gridColor = css('--border');
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

    // Monthly bar chart
    const keys = last6Months();
    const inc = keys.map((k) => all.filter((t) => t.type === 'income' && monthKey(t.transaction_date) === k).reduce((s, t) => s + t.amount, 0));
    const exp = keys.map((k) => all.filter((t) => t.type === 'expense' && monthKey(t.transaction_date) === k).reduce((s, t) => s + t.amount, 0));
    if (charts.monthly) charts.monthly.destroy();
    charts.monthly = new Chart($('monthlyChart'), {
      type: 'bar',
      data: {
        labels: keys.map(monthLabel),
        datasets: [
          { label: 'Income', data: inc, backgroundColor: css('--income'), borderRadius: 6 },
          { label: 'Expenses', data: exp, backgroundColor: css('--expense'), borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + money(c.parsed.y) } } },
        scales: { y: { beginAtZero: true, grid: { color: gridColor } }, x: { grid: { display: false } } }
      }
    });

    // Category doughnut
    const byCat = categoryTotals(all);
    const labels = Object.keys(byCat);
    if (charts.category) charts.category.destroy();
    const box = $('catBox');
    let note = box.querySelector('.empty');
    if (!labels.length) {
      $('categoryChart').classList.add('hidden');
      if (!note) { note = el('div', 'empty'); note.appendChild(el('p', '', 'No expenses yet.')); box.appendChild(note); }
      return;
    }
    if (note) note.remove();
    $('categoryChart').classList.remove('hidden');
    charts.category = new Chart($('categoryChart'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: labels.map((l) => byCat[l]), backgroundColor: labels.map((l) => CAT_COLORS[CATEGORIES.indexOf(l) % CAT_COLORS.length]), borderColor: css('--surface'), borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => c.label + ': ' + money(c.parsed) } }
        }
      }
    });
  }

  function categoryTotals(list) {
    const out = {};
    list.filter((t) => t.type === 'expense').forEach((t) => { out[t.category] = (out[t.category] || 0) + t.amount; });
    return out;
  }

  // ---------- transactions page ----------
  function currentFilters() {
    const p = new URLSearchParams();
    const s = $('fSearch').value.trim();
    if (s) p.set('search', s);
    if ($('fType').value) p.set('type', $('fType').value);
    if ($('fCategory').value) p.set('category', $('fCategory').value);
    if ($('fMonth').value) p.set('month', $('fMonth').value);
    else {
      if ($('fFrom').value) p.set('from', $('fFrom').value);
      if ($('fTo').value) p.set('to', $('fTo').value);
    }
    return p;
  }
  function filtersActive() { return currentFilters().toString() !== ''; }

  async function loadTransactions() {
    setLoading(true);
    showPageError('');
    try {
      const qs = currentFilters().toString();
      const data = await api('/transactions' + (qs ? '?' + qs : ''));
      renderTable(data.transactions.map((t) => ({ ...t, amount: Number(t.amount) })));
    } catch (e) {
      showPageError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function renderTable(list) {
    const body = $('txBody');
    body.replaceChildren();
    const empty = list.length === 0;
    $('txEmpty').classList.toggle('hidden', !empty);
    if (empty) {
      const filtered = filtersActive();
      $('txEmptyTitle').textContent = filtered ? 'No matching transactions' : 'No transactions yet';
      $('txEmptyText').textContent = filtered ? 'Try changing or clearing your filters.' : 'Add your first income or expense to get started.';
      $('txEmptyBtn').classList.toggle('hidden', filtered);
    }
    list.forEach((tx) => {
      const tr = el('tr');
      tr.appendChild(el('td', '', dateLabel(tx.transaction_date)));
      const d = el('td'); d.appendChild(el('div', '', tx.description));
      if (tx.notes) d.appendChild(el('div', 'sub-note', tx.notes));
      tr.appendChild(d);
      const c = el('td'); c.appendChild(el('span', 'badge badge-cat', tx.category)); tr.appendChild(c);
      tr.appendChild(el('td', '', tx.payment_method));
      const ty = el('td'); ty.appendChild(typeBadge(tx)); tr.appendChild(ty);
      tr.appendChild(amountCell(tx));
      const act = el('td'); const row = el('div', 'row-actions');
      const eb = el('button', 'btn btn-secondary btn-sm', 'Edit');
      eb.type = 'button'; eb.setAttribute('aria-label', 'Edit ' + tx.description);
      eb.addEventListener('click', () => openForm(tx));
      const db = el('button', 'btn btn-danger btn-sm', 'Delete');
      db.type = 'button'; db.setAttribute('aria-label', 'Delete ' + tx.description);
      db.addEventListener('click', () => askDelete(tx));
      row.append(eb, db); act.appendChild(row); tr.appendChild(act);
      body.appendChild(tr);
    });
  }

  // ---------- add / edit form ----------
  function setFieldError(id, msg) {
    const input = $(id); const err = $(id + 'Error');
    input.classList.toggle('invalid', !!msg);
    if (err) err.textContent = msg || '';
  }
  function openForm(tx) {
    editingId = tx ? tx.id : null;
    $('txDialogTitle').textContent = tx ? 'Edit transaction' : 'Add transaction';
    const f = $('txForm');
    f.type.value = tx ? tx.type : 'expense';
    f.amount.value = tx ? tx.amount : '';
    f.date.value = tx ? tx.transaction_date : todayStr();
    f.description.value = tx ? tx.description : '';
    f.category.value = tx ? tx.category : 'Food';
    $('method').value = tx ? tx.payment_method : 'Cash';
    f.notes.value = tx && tx.notes ? tx.notes : '';
    ['amount', 'date', 'description'].forEach((id) => setFieldError(id, ''));
    $('formError').classList.add('hidden');
    $('txDialog').showModal();
    $('amount').focus();
  }
  function closeForm() { $('txDialog').close(); }

  async function submitForm(e) {
    e.preventDefault();
    const f = $('txForm');
    let bad = false;
    const amount = Number(f.amount.value);
    setFieldError('amount', ''); setFieldError('date', ''); setFieldError('description', '');
    if (!f.amount.value || !Number.isFinite(amount) || amount <= 0) { setFieldError('amount', 'Enter an amount greater than 0.'); bad = true; }
    if (!f.date.value) { setFieldError('date', 'Choose a date.'); bad = true; }
    if (!f.description.value.trim()) { setFieldError('description', 'Enter a description.'); bad = true; }
    if (bad) return;

    const payload = {
      type: f.type.value,
      amount,
      description: f.description.value.trim(),
      category: f.category.value,
      transaction_date: f.date.value,
      payment_method: $('method').value,
      notes: f.notes.value.trim()
    };
    const btn = $('saveBtn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      if (editingId) await api('/transactions/' + editingId, { method: 'PUT', body: payload });
      else await api('/transactions', { method: 'POST', body: payload });
      closeForm();
      toast(editingId ? 'Transaction updated.' : 'Transaction added.');
      await refresh();
    } catch (err) {
      const box = $('formError');
      box.textContent = err.message;
      box.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  }

  // ---------- delete ----------
  function askDelete(tx) {
    deleteId = tx.id;
    $('confirmText').textContent = '"' + tx.description + '" (' + money(tx.amount) + ') will be permanently removed.';
    $('confirmDialog').showModal();
  }
  async function confirmDelete() {
    const btn = $('confirmYes');
    btn.disabled = true;
    try {
      await api('/transactions/' + deleteId, { method: 'DELETE' });
      $('confirmDialog').close();
      toast('Transaction deleted.');
      await refresh();
    } catch (err) {
      $('confirmDialog').close();
      toast(err.message, true);
    } finally {
      btn.disabled = false; deleteId = null;
    }
  }

  // ---------- reports ----------
  function refreshReportMonths() {
    const sel = $('rMonth');
    const keep = sel.value;
    const months = [...new Set(all.map((t) => monthKey(t.transaction_date)))].sort().reverse();
    sel.replaceChildren(new Option('All time', ''));
    months.forEach((m) => sel.appendChild(new Option(monthLabel(m), m)));
    sel.value = months.includes(keep) ? keep : '';
  }
  function reportScope() {
    const m = $('rMonth').value;
    return m ? all.filter((t) => monthKey(t.transaction_date) === m) : all;
  }
  function renderReports() {
    const scope = reportScope();

    const byMonth = {};
    scope.forEach((t) => {
      const k = monthKey(t.transaction_date);
      byMonth[k] = byMonth[k] || { income: 0, expense: 0 };
      byMonth[k][t.type] += t.amount;
    });
    const mBody = $('repMonthBody'); mBody.replaceChildren();
    const mKeys = Object.keys(byMonth).sort().reverse();
    $('repMonthEmpty').classList.toggle('hidden', mKeys.length > 0);
    mKeys.forEach((k) => {
      const r = byMonth[k]; const net = r.income - r.expense;
      const tr = el('tr');
      tr.appendChild(el('td', '', monthLabel(k)));
      tr.appendChild(el('td', 'num amt-income', money(r.income)));
      tr.appendChild(el('td', 'num amt-expense', money(r.expense)));
      tr.appendChild(el('td', 'num ' + (net >= 0 ? 'amt-income' : 'amt-expense'), money(net)));
      mBody.appendChild(tr);
    });

    const byCat = categoryTotals(scope);
    const total = Object.values(byCat).reduce((s, v) => s + v, 0);
    const cBody = $('repCatBody'); cBody.replaceChildren();
    const cKeys = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    $('repCatEmpty').classList.toggle('hidden', cKeys.length > 0);
    cKeys.forEach((k) => {
      const tr = el('tr');
      tr.appendChild(el('td', '', k));
      tr.appendChild(el('td', 'num', money(byCat[k])));
      tr.appendChild(el('td', 'num', (total ? (byCat[k] / total * 100).toFixed(1) : '0.0') + '%'));
      cBody.appendChild(tr);
    });
  }

  // Stops spreadsheets from running formulas that start with = + - @
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function downloadCsv() {
    const scope = reportScope();
    if (!scope.length) { toast('Nothing to export for this period.', true); return; }
    const rows = [['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Payment method', 'Notes']];
    scope.forEach((t) => rows.push([t.transaction_date, t.type, t.category, t.description, t.amount.toFixed(2), t.payment_method, t.notes || '']));
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense-report-' + ($('rMonth').value || 'all-time') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('CSV downloaded.');
  }

  // ---------- profile ----------
  function renderProfile() {
    $('pEmail').textContent = session.user.email;
    $('pCreated').textContent = session.user.created_at ? new Date(session.user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    $('pCount').textContent = String(all.length);
  }

  // ---------- start ----------
  async function init() {
    session = await requireSession();
    if (!session) return;
    $('sidebarEmail').textContent = session.user.email;

    CATEGORIES.forEach((c) => { $('category').appendChild(new Option(c, c)); $('fCategory').appendChild(new Option(c, c)); });
    METHODS.forEach((m) => $('method').appendChild(new Option(m, m)));

    document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
    $('menuBtn').addEventListener('click', openMenu);
    $('overlay').addEventListener('click', closeMenu);
    $('addBtn').addEventListener('click', () => openForm(null));
    document.addEventListener('click', (e) => { if (e.target.closest('[data-open-add]')) openForm(null); });
    $('cancelBtn').addEventListener('click', closeForm);
    $('txForm').addEventListener('submit', submitForm);
    $('confirmNo').addEventListener('click', () => $('confirmDialog').close());
    $('confirmYes').addEventListener('click', confirmDelete);
    $('csvBtn').addEventListener('click', downloadCsv);
    $('printBtn').addEventListener('click', () => window.print());
    $('rMonth').addEventListener('change', renderReports);
    $('logoutBtn').addEventListener('click', async () => {
      const client = await initSupabase();
      await client.auth.signOut();
      window.location.href = 'login.html';
    });

    // Filters: text box waits a moment while typing; others apply right away.
    let timer;
    $('fSearch').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadTransactions, 300); });
    ['fType', 'fCategory', 'fMonth', 'fFrom', 'fTo'].forEach((id) => $(id).addEventListener('change', loadTransactions));
    $('filterForm').addEventListener('submit', (e) => e.preventDefault());
    $('clearFilters').addEventListener('click', () => { $('filterForm').reset(); loadTransactions(); });

    document.addEventListener('themechange', () => { if (currentView === 'dashboard') drawCharts(); });

    const client = await initSupabase();
    client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') window.location.href = 'login.html'; });

    await loadAll();
    refreshReportMonths();
    showView('dashboard');
  }

  init().catch((e) => { setLoading(false); showPageError(e.message || 'Could not start the app.'); });
})();
