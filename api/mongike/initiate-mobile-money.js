const API_BASE_URL = 'https://mongike.com/api/v1';
const MONGIKE_API_KEY = process.env.MONGIKE_API_KEY;

const readJsonBody = async (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch (error) {
    return {};
  }
};

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    if (!String(req.headers['content-type'] || '').includes('application/json')) {
      res.status(415).json({ status: 'error', message: 'Expected JSON request body.' });
      return;
    }

    const body = await readJsonBody(req);
    const {
      order_id,
      amount,
      buyer_phone,
      buyer_name,
      buyer_email,
      fee_payer = 'MERCHANT',
      metadata = {}
    } = body || {};

    if (!order_id || !amount || !buyer_phone) {
      res.status(400).json({
        status: 'error',
        message: 'order_id, amount and buyer_phone are required.'
      });
      return;
    }

    if (!/^[A-Za-z0-9._-]{4,64}$/.test(String(order_id))) {
      res.status(422).json({ status: 'error', message: 'Invalid order ID format.' });
      return;
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      res.status(422).json({ status: 'error', message: 'Amount must be a positive number.' });
      return;
    }

    const normalizedPhone = String(buyer_phone).replace(/\D+/g, '');
    if (!/^\d{9,15}$/.test(normalizedPhone)) {
      res.status(422).json({ status: 'error', message: 'Invalid buyer phone number.' });
      return;
    }

    if (buyer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(buyer_email))) {
      res.status(422).json({ status: 'error', message: 'Invalid buyer email address.' });
      return;
    }

    if (!MONGIKE_API_KEY) {
      res.status(500).json({
        status: 'error',
        message: 'MONGIKE_API_KEY is missing on the server.'
      });
      return;
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const webhook_url = host ? `${protocol}://${host}/api/mongike/webhook` : undefined;

    const upstreamResponse = await fetch(`${API_BASE_URL}/payments/mobile-money/tanzania`, {
      method: 'POST',
      headers: {
        'x-api-key': MONGIKE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id,
        amount,
        buyer_phone: normalizedPhone,
        buyer_name,
        buyer_email,
        fee_payer: String(fee_payer || 'MERCHANT').toUpperCase() === 'CUSTOMER' ? 'CUSTOMER' : 'MERCHANT',
        metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
        ...(webhook_url ? { webhook_url } : {})
      })
    });

    const text = await upstreamResponse.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = {
        status: upstreamResponse.ok ? 'success' : 'error',
        message: text || 'Unexpected Mongike response'
      };
    }

    if (!upstreamResponse.ok) {
      res.status(upstreamResponse.status).json({
        ...data,
        upstreamStatus: upstreamResponse.status
      });
      return;
    }

    res.status(upstreamResponse.status).json(data);
  } catch (error) {
    console.error('Mongike initiate mobile money error:', error?.message || error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate mobile money payment.'
    });
  }
};
