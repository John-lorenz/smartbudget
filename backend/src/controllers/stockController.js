const pool = require('../config/database');

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
}

function buildBrapiUrl(path, params = {}) {
  const url = new URL(`https://brapi.dev/api/${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  if (process.env.BRAPI_TOKEN) {
    url.searchParams.set('token', process.env.BRAPI_TOKEN);
  }

  return url;
}

function mapBrapiQuote(quote, fallbackSymbol) {
  const normalized = normalizeSymbol(fallbackSymbol || quote.symbol);
  const currency = String(quote.currency || 'BRL').toUpperCase();

  return {
    symbol: quote.symbol || normalized,
    name: quote.shortName || quote.longName || quote.symbol || normalized,
    price: quote.regularMarketPrice ?? null,
    changePercent: quote.regularMarketChangePercent ?? null,
    currency,
    updatedAt: quote.regularMarketTime || new Date().toISOString(),
  };
}

async function fetchQuotes(symbols) {
  const normalized = [...new Set(
    symbols.map(normalizeSymbol).filter((symbol) => /^[A-Z0-9.]{2,20}$/.test(symbol))
  )];

  if (normalized.length === 0) {
    return {};
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(buildBrapiUrl(`quote/${encodeURIComponent(normalized.join(','))}`), {
      signal: controller.signal,
    });

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const quotes = {};

    results.forEach((quote) => {
      const mapped = mapBrapiQuote(quote);
      quotes[mapped.symbol] = mapped;
    });

    normalized.forEach((symbol) => {
      if (!quotes[symbol]) {
        quotes[symbol] = {
          symbol,
          name: symbol,
          price: null,
          changePercent: null,
          currency: 'BRL',
          updatedAt: new Date().toISOString(),
        };
      }
    });

    return quotes;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchQuote(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!/^[A-Z0-9.]{2,20}$/.test(normalized)) {
    const error = new Error('Código da ação inválido');
    error.status = 400;
    throw error;
  }

  const quotes = await fetchQuotes([normalized]);
  const quote = quotes[normalized];

  if (!quote || quote.price === null) {
    const error = new Error('Ação não encontrada');
    error.status = 404;
    throw error;
  }

  return quote;
}

exports.search = async (req, res) => {
  try {
    const search = normalizeSymbol(req.query.q);

    if (search.length < 2) {
      return res.json([]);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(buildBrapiUrl('available', { search }), {
        signal: controller.signal,
      });

      if (!response.ok) {
        return res.json([]);
      }

      const data = await response.json();
      const symbols = Array.isArray(data.stocks) ? data.stocks : [];

      return res.json(symbols.slice(0, 12).map((symbol) => ({
        symbol: typeof symbol === 'string' ? symbol : symbol.stock || symbol.symbol,
        name: typeof symbol === 'string' ? symbol : symbol.name || symbol.stock || symbol.symbol,
      })).filter((item) => item.symbol));
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error('Erro ao buscar ações:', err);
    return res.json([]);
  }
};

exports.quote = async (req, res) => {
  try {
    const quote = await fetchQuote(req.params.symbol);
    return res.json(quote);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar cotação' });
  }
};

exports.list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM stock_watchlist
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    const quotes = await fetchQuotes(result.rows.map((stock) => stock.symbol));

    const stocks = result.rows.map((stock) => ({
      ...stock,
      quote: quotes[stock.symbol] || null,
    }));

    return res.json(stocks);
  } catch (err) {
    console.error('Erro ao listar ações monitoradas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.create = async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.body.symbol);
    const targetPrice = req.body.targetPrice || req.body.target_price || null;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : null;

    if (!/^[A-Z0-9.]{2,20}$/.test(symbol)) {
      return res.status(400).json({ error: 'Informe um código de ação válido. Ex: PETR4, VALE3 ou AAPL' });
    }

    if (targetPrice !== null && Number(targetPrice) <= 0) {
      return res.status(400).json({ error: 'Preço alvo deve ser maior que zero' });
    }

    const existing = await pool.query(
      'SELECT id FROM stock_watchlist WHERE user_id = $1 AND symbol = $2',
      [req.userId, symbol]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Esta ação já está no monitoramento' });
    }

    const result = await pool.query(
      `INSERT INTO stock_watchlist (user_id, symbol, target_price, note)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.userId, symbol, targetPrice, note || null]
    );

    const row = result.rows[0];
    const quotes = await fetchQuotes([row.symbol]);
    const quote = quotes[row.symbol] || null;

    return res.status(201).json({ ...row, quote });
  } catch (err) {
    console.error('Erro ao salvar ação monitorada:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM stock_watchlist WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ação monitorada não encontrada' });
    }

    return res.json({ message: 'Ação removida do monitoramento' });
  } catch (err) {
    console.error('Erro ao remover ação monitorada:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
