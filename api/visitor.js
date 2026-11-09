// Vercel serverless route: reuses the same server-side handler (API key + Blob token stay on the server).
const { handler } = require('../server/api.js');
module.exports = (req, res) => handler(req, res, () => { res.statusCode = 404; res.end('not found'); });
