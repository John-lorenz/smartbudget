const pool = require('../config/database');

function normalizeCoinId(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCurrency(value) {
  return String(value || 'brl').toLowerCase() === 'usd' ? 'usd' : 'brl';
}

async function fetchCryptoQuotes(coinIds, currency = 'brl') {
  const vs = normalizeCurrency(currency);
  const ids = [...new Set(coinIds.map(normalizeCoinId).filter(Boolean))];

  if (ids.length === 0) {
    return {};
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=brl,usd&include_24hr_change=true`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const quotes = {};

    ids.forEach((id) => {
      const quote = data[id];
      if (!quote) return;

      const changePercent = quote.usd_24h_change ?? quote.brl_24h_change ?? null;

      quotes[id] = {
        coinId: id,
        symbol: id.toUpperCase(),
        name: id,
        price: quote[vs] ?? null,
        changePercent,
        currency: vs.toUpperCase(),
        updatedAt: new Date().toISOString(),
      };
    });

    return quotes;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCryptoQuote(coinId, currency = 'brl') {
  const normalized = normalizeCoinId(coinId);
  const quotes = await fetchCryptoQuotes([normalized], currency);
  const quote = quotes[normalized];

  if (!quote) {
    const error = new Error('Criptomoeda não encontrada');
    error.status = 404;
    throw error;
  }

  return quote;
}

exports.search = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();

    if (search.length < 2) {
      return res.json([]);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(search)}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        return res.json([]);
      }

      const data = await response.json();
      const coins = Array.isArray(data.coins) ? data.coins : [];

      return res.json(coins.slice(0, 12).map((coin) => ({
        coinId: coin.id,
        symbol: String(coin.symbol || '').toUpperCase(),
        name: coin.name,
        rank: coin.market_cap_rank || null,
      })));
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error('Erro ao buscar criptomoedas:', err);
    return res.json([]);
  }
};

exports.quote = async (req, res) => {
  try {
    const currency = normalizeCurrency(req.query.currency);
    const quote = await fetchCryptoQuote(req.params.coinId, currency);
    return res.json(quote);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar cotação da cripto' });
  }
};

exports.list = async (req, res) => {
  try {
    const currency = normalizeCurrency(req.query.currency);

    const result = await pool.query(
      `SELECT *
       FROM crypto_watchlist
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    const quotes = await fetchCryptoQuotes(result.rows.map((row) => row.coin_id), currency);

    const cryptos = result.rows.map((crypto) => {
      const quote = quotes[crypto.coin_id];
      return {
        ...crypto,
        quote: quote
          ? { ...quote, symbol: crypto.symbol, name: crypto.name }
          : null,
      };
    });

    return res.json(cryptos);
  } catch (err) {
    console.error('Erro ao listar criptomoedas monitoradas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.create = async (req, res) => {
  try {
    const coinId = normalizeCoinId(req.body.coinId || req.body.coin_id);
    const currency = normalizeCurrency(req.body.currency || req.query.currency);
    const targetPrice = req.body.targetPrice || req.body.target_price || null;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : null;
    const symbol = String(req.body.symbol || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();

    if (!/^[a-z0-9-]{2,60}$/.test(coinId) || !symbol || !name) {
      return res.status(400).json({ error: 'Informe uma criptomoeda válida. Ex: Bitcoin, Ethereum ou Solana' });
    }

    if (targetPrice !== null && Number(targetPrice) <= 0) {
      return res.status(400).json({ error: 'Preço alvo deve ser maior que zero' });
    }

    const existing = await pool.query(
      'SELECT id FROM crypto_watchlist WHERE user_id = $1 AND coin_id = $2',
      [req.userId, coinId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Esta criptomoeda já está no monitoramento' });
    }

    const result = await pool.query(
      `INSERT INTO crypto_watchlist (user_id, coin_id, symbol, name, target_price, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, coinId, symbol, name, targetPrice, note || null]
    );

    const row = result.rows[0];
    let quote = null;

    try {
      quote = await fetchCryptoQuote(row.coin_id, currency);
      if (quote) {
        quote.symbol = row.symbol;
        quote.name = row.name;
      }
    } catch {
      quote = null;
    }

    return res.status(201).json({ ...row, quote });
  } catch (err) {
    console.error('Erro ao salvar criptomoeda monitorada:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM crypto_watchlist WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Criptomoeda monitorada não encontrada' });
    }

    return res.json({ message: 'Criptomoeda removida do monitoramento' });
  } catch (err) {
    console.error('Erro ao remover criptomoeda monitorada:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
