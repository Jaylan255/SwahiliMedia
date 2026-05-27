const crypto = require('crypto');

const MONGIKE_API_KEY = process.env.MONGIKE_API_KEY;

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  const incomingKey = String(req.headers['x-api-key'] || '');
  const expectedKey = String(MONGIKE_API_KEY || '');
  const signaturesMatch =
    expectedKey.length > 0 &&
    incomingKey.length === expectedKey.length &&
    crypto.timingSafeEqual(Buffer.from(incomingKey), Buffer.from(expectedKey));

  if (!signaturesMatch) {
    res.status(401).json({ status: 'error', message: 'Invalid webhook signature' });
    return;
  }

  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  console.log('Mongike webhook received:', {
    payload_sha256: crypto.createHash('sha256').update(payload).digest('hex'),
    payload_size: payload.length,
  });
  res.status(200).json({ status: 'success', message: 'Webhook received' });
};
