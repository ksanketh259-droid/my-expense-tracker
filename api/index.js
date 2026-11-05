// Vercel entry point. Vercel runs this file as a serverless function.
// All /api/* requests are rewritten here (see vercel.json).
module.exports = require('../backend/src/app');
