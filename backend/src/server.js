// Local development server.
// Serves the frontend files AND the API on one address: http://localhost:3000
const path = require('path');
const express = require('express');
const app = require('./app');

const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`My Expense Tracker running at http://localhost:${PORT}`);
});
