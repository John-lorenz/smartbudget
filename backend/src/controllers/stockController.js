const pool = require('../config/database');

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
}

function toYahooSymbol(symbol) {
  // Tickers B3 (PETR4, VALE3, ITUB4, BOVA11...) recebem o sufixo .SA
  if (/^[A-Z]{4}\d{1,2}$/.test(symbol)) return `${symbol}.SA`;
  return symbol;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildBrapiUrl(path, params = {}) {
  const url = new URL(`https://brapi.dev/api/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  if (process.env.BRAPI_TOKEN) {
    url.searchParams.set('token', process.env.BRAPI_TOKEN);
  }
  return url;
}

async function fetchYahooQuote(symbol) {
  const ysymbol = toYahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysymbol)}?interval=1d&range=5d`;

  try {
    const response = await fetchWithTimeout(url, { headers: YAHOO_HEADERS }, 7000);
    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const changePercent = (price !== null && prevClose !== null && prevClose !== 0)
      ? ((price - prevClose) / prevClose) * 100
      : null;

    return {
      symbol,
      name: meta.longName || meta.shortName || symbol,
      price,
      changePercent,
      currency: (meta.currency || 'BRL').toUpperCase(),
      updatedAt: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[stocks] Yahoo falhou para ${symbol}:`, err.message);
    return null;
  }
}

async function fetchBrapiQuote(symbol) {
  if (!process.env.BRAPI_TOKEN) return null;
  try {
    const response = await fetchWithTimeout(buildBrapiUrl(`quote/${encodeURIComponent(symbol)}`), {}, 7000);
    if (!response.ok) return null;
    const data = await response.json();
    const quote = Array.isArray(data.results) ? data.results[0] : null;
    if (!quote) return null;

    return {
      symbol: quote.symbol || symbol,
      name: quote.shortName || quote.longName || symbol,
      price: quote.regularMarketPrice ?? null,
      changePercent: quote.regularMarketChangePercent ?? null,
      currency: (quote.currency || 'BRL').toUpperCase(),
      updatedAt: quote.regularMarketTime || new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[stocks] Brapi falhou para ${symbol}:`, err.message);
    return null;
  }
}

async function fetchQuoteForSymbol(symbol) {
  const yahoo = await fetchYahooQuote(symbol);
  if (yahoo && yahoo.price !== null) return yahoo;

  const brapi = await fetchBrapiQuote(symbol);
  if (brapi && brapi.price !== null) return brapi;

  return {
    symbol,
    name: yahoo?.name || brapi?.name || symbol,
    price: null,
    changePercent: null,
    currency: 'BRL',
    updatedAt: new Date().toISOString(),
  };
}

async function fetchQuotes(symbols) {
  const normalized = [...new Set(
    symbols.map(normalizeSymbol).filter((symbol) => /^[A-Z0-9.]{2,20}$/.test(symbol))
  )];

  if (normalized.length === 0) return {};

  const results = await Promise.all(normalized.map((symbol) => fetchQuoteForSymbol(symbol)));

  const quotes = {};
  results.forEach((quote, idx) => {
    quotes[normalized[idx]] = quote;
  });
  return quotes;
}

async function fetchQuote(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!/^[A-Z0-9.]{2,20}$/.test(normalized)) {
    const error = new Error('Código da ação inválido');
    error.status = 400;
    throw error;
  }

  const quote = await fetchQuoteForSymbol(normalized);
  if (!quote || quote.price === null) {
    const error = new Error('Ação não encontrada');
    error.status = 404;
    throw error;
  }
  return quote;
}

exports.search = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    if (search.length < 2) return res.json([]);

    // 1. Tenta Yahoo Search (sem auth, retorna nome amigável)
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=15&newsCount=0`;
      const response = await fetchWithTimeout(yahooUrl, { headers: YAHOO_HEADERS }, 6000);
      if (response.ok) {
        const data = await response.json();
        const quotes = Array.isArray(data.quotes) ? data.quotes : [];
        const items = quotes
          .filter((q) => q.symbol && (q.symbol.endsWith('.SA') || /^[A-Z]{4}\d{1,2}$/.test(q.symbol)))
          .map((q) => ({
            symbol: q.symbol.replace(/\.SA$/, ''),
            name: q.longname || q.shortname || q.symbol,
          }))
          .slice(0, 12);
        if (items.length > 0) return res.json(items);
      }
    } catch (err) {
      console.error('[stocks] Yahoo search falhou:', err.message);
    }

    // 2. Fallback para Brapi (se houver token)
    if (process.env.BRAPI_TOKEN) {
      try {
        const response = await fetchWithTimeout(
          buildBrapiUrl('available', { search: normalizeSymbol(search) }),
          {},
          6000
        );
        if (response.ok) {
          const data = await response.json();
          const symbols = Array.isArray(data.stocks) ? data.stocks : [];
          return res.json(symbols.slice(0, 12).map((symbol) => ({
            symbol: typeof symbol === 'string' ? symbol : symbol.stock || symbol.symbol,
            name: typeof symbol === 'string' ? symbol : symbol.name || symbol.stock || symbol.symbol,
          })).filter((item) => item.symbol));
        }
      } catch (err) {
        console.error('[stocks] Brapi search falhou:', err.message);
      }
    }

    return res.json([]);
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
      // Se a tabela não tem name persistido, prefere o nome vindo da cotação
      name: stock.name || quotes[stock.symbol]?.name || null,
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
    const quote = await fetchQuoteForSymbol(row.symbol);

    return res.status(201).json({
      ...row,
      name: quote?.name || null,
      quote,
    });
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
