import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTarget,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';

const INITIAL_FORM = { symbol: '', targetPrice: '', note: '', coinId: '', name: '' };
const QUOTE_REFRESH_SECONDS = 30;
const CURRENCY_STORAGE_KEY = 'smartbudget_quote_currency';

const QUICK_PICKS = {
  stocks: [
    { symbol: 'PETR4', name: 'Petrobras' },
    { symbol: 'VALE3', name: 'Vale' },
    { symbol: 'ITUB4', name: 'Itaú' },
    { symbol: 'BBAS3', name: 'Banco do Brasil' },
  ],
  crypto: [
    { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { coinId: 'solana', symbol: 'SOL', name: 'Solana' },
    { coinId: 'ripple', symbol: 'XRP', name: 'XRP' },
  ],
};

function formatQuotePrice(value, currencyCode = 'BRL') {
  if (value === null || value === undefined) return '—';
  const code = String(currencyCode || 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL';
  const locale = code === 'USD' ? 'en-US' : 'pt-BR';
  return Number(value).toLocaleString(locale, { style: 'currency', currency: code });
}

function readStoredCurrency() {
  try {
    return localStorage.getItem(CURRENCY_STORAGE_KEY) === 'usd' ? 'usd' : 'brl';
  } catch {
    return 'brl';
  }
}

function mergeQuoteChanges(previous, incoming) {
  return incoming.map((item) => {
    const old = previous.find((row) => row.id === item.id);
    const prevChange = old?.quote?.changePercent;
    const nextChange = item.quote?.changePercent;

    if (prevChange != null && (nextChange == null || Number.isNaN(Number(nextChange)))) {
      return {
        ...item,
        quote: item.quote ? { ...item.quote, changePercent: prevChange } : old.quote,
      };
    }

    return item;
  });
}

function getTargetProgress(current, target) {
  if (!target || !current) return null;
  const currentNum = Number(current);
  const targetNum = Number(target);
  if (targetNum <= 0) return null;

  const reached = currentNum <= targetNum;
  const progress = Math.min((targetNum / currentNum) * 100, 100);

  return { reached, progress, gap: currentNum - targetNum };
}

export default function Stocks() {
  const [activeType, setActiveType] = useState('stocks');
  const [stocks, setStocks] = useState([]);
  const [cryptos, setCryptos] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [listSearch, setListSearch] = useState('');
  const [sortBy, setSortBy] = useState('change');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState(readStoredCurrency);

  const isCrypto = activeType === 'crypto';
  const currentAssets = isCrypto ? cryptos : stocks;

  const loadAssets = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = { currency };
      const [stocksRes, cryptosRes] = await Promise.all([
        api.get('/stocks', { params }),
        api.get('/crypto', { params }),
      ]);
      setStocks((prev) => mergeQuoteChanges(prev, stocksRes.data));
      setCryptos((prev) => mergeQuoteChanges(prev, cryptosRes.data));
      setLastUpdated(new Date());
    } catch {
      if (!silent) {
        toast.error('Erro ao carregar monitoramento');
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [currency]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAssets(true);
      }
    }, QUOTE_REFRESH_SECONDS * 1000);

    return () => clearInterval(timer);
  }, [loadAssets]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch {
      // ignore
    }
  }, [currency]);

  const availableQuickPicks = useMemo(() => {
    const picks = QUICK_PICKS[activeType];
    if (isCrypto) {
      const ids = new Set(cryptos.map((item) => item.coin_id));
      return picks.filter((item) => !ids.has(item.coinId));
    }
    const symbols = new Set(stocks.map((item) => item.symbol));
    return picks.filter((item) => !symbols.has(item.symbol));
  }, [activeType, cryptos, stocks, isCrypto]);

  const displayCurrency = currency === 'usd' ? 'USD' : 'BRL';

  useEffect(() => {
    const search = form.symbol.trim();
    if (search.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const endpoint = isCrypto ? '/crypto/search' : '/stocks/search';
        const response = await api.get(endpoint, { params: { q: search } });
        setSuggestions(response.data);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [form.symbol, isCrypto]);

  const stats = useMemo(() => {
    const all = [...stocks, ...cryptos];
    let targetsHit = 0;
    let positive = 0;
    let negative = 0;

    all.forEach((asset) => {
      const quote = asset.quote;
      const change = Number(quote?.changePercent || 0);
      if (quote?.changePercent !== null && quote?.changePercent !== undefined) {
        if (change >= 0) positive += 1;
        else negative += 1;
      }
      const progress = getTargetProgress(quote?.price, asset.target_price);
      if (progress?.reached) targetsHit += 1;
    });

    return {
      total: all.length,
      targetsHit,
      positive,
      negative,
    };
  }, [stocks, cryptos]);

  const filteredAssets = useMemo(() => {
    const term = listSearch.trim().toUpperCase();
    let items = [...currentAssets];

    if (term) {
      items = items.filter((asset) => (
        asset.symbol?.toUpperCase().includes(term) ||
        asset.name?.toUpperCase().includes(term)
      ));
    }

    items.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.symbol || '').localeCompare(b.symbol || '');
      }
      if (sortBy === 'target') {
        const progA = getTargetProgress(a.quote?.price, a.target_price)?.progress ?? 0;
        const progB = getTargetProgress(b.quote?.price, b.target_price)?.progress ?? 0;
        return progB - progA;
      }
      const changeA = Number(a.quote?.changePercent || 0);
      const changeB = Number(b.quote?.changePercent || 0);
      return changeB - changeA;
    });

    return items;
  }, [currentAssets, listSearch, sortBy]);

  function changeType(type) {
    setActiveType(type);
    setForm(INITIAL_FORM);
    setSuggestions([]);
    setListSearch('');
    setShowSuggestions(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      if (isCrypto) {
        if (!form.coinId) {
          toast.error('Selecione uma cripto na lista de sugestões');
          setSaving(false);
          return;
        }
        if (cryptos.some((item) => item.coin_id === form.coinId)) {
          toast.error('Esta criptomoeda já está no monitoramento');
          setSaving(false);
          return;
        }
        const { data } = await api.post('/crypto', {
          coinId: form.coinId,
          symbol: form.symbol,
          name: form.name,
          targetPrice: form.targetPrice ? Number(form.targetPrice) : null,
          note: form.note,
          currency,
        });
        setCryptos((prev) => [data, ...prev]);
        toast.success('Cripto adicionada!');
      } else {
        const symbol = form.symbol.trim().toUpperCase();
        if (stocks.some((item) => item.symbol === symbol)) {
          toast.error('Esta ação já está no monitoramento');
          setSaving(false);
          return;
        }
        const { data } = await api.post('/stocks', {
          symbol,
          targetPrice: form.targetPrice ? Number(form.targetPrice) : null,
          note: form.note,
        });
        setStocks((prev) => [data, ...prev]);
        toast.success('Ação adicionada!');
      }

      setForm(INITIAL_FORM);
      setShowSuggestions(false);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm(`Remover ${isCrypto ? 'esta cripto' : 'esta ação'}?`)) return;
    try {
      await api.delete(`/${isCrypto ? 'crypto' : 'stocks'}/${id}`);
      toast.success('Removido');
      loadAssets(false);
    } catch {
      toast.error('Erro ao remover');
    }
  }

  function selectAsset(asset) {
    setForm({
      ...form,
      symbol: asset.symbol,
      coinId: asset.coinId || '',
      name: asset.name,
    });
    setShowSuggestions(false);
  }

  function quickAdd(asset) {
    setForm({
      ...INITIAL_FORM,
      symbol: asset.symbol,
      coinId: asset.coinId || '',
      name: asset.name,
    });
    setShowAddForm(true);
  }

  if (loading && stocks.length === 0 && cryptos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-emerald-200 border-t-emerald-600" />
          <span className="text-sm text-gray-400">Carregando carteira...</span>
        </div>
      </div>
    );
  }

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Carteira</p>
          <h1 className="sb-title">Monitor de Investimentos</h1>
          <p className="sb-subtitle mt-1">
            Cotações atualizam automaticamente a cada {QUOTE_REFRESH_SECONDS}s
            {refreshing && <span className="text-emerald-600 font-medium"> · atualizando...</span>}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Última atualização: {lastUpdatedLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {[
              { value: 'brl', label: 'R$' },
              { value: 'usd', label: 'US$' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCurrency(item.value)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currency === item.value
                    ? 'sb-tab-active'
                    : 'sb-tab-inactive hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => loadAssets(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all disabled:opacity-50 cursor-pointer"
          >
            <FiRefreshCw size={16} className={loading || refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ativos', value: stats.total, icon: FiActivity, tone: 'sb-stat-icon-indigo' },
          { label: 'Alvos atingidos', value: stats.targetsHit, icon: FiTarget, tone: 'sb-stat-icon-emerald' },
          { label: 'Em alta (24h)', value: stats.positive, icon: FiTrendingUp, tone: 'sb-stat-icon-green' },
          { label: 'Em queda (24h)', value: stats.negative, icon: FiTrendingDown, tone: 'sb-stat-icon-red' },
        ].map(({ label, value, icon, tone }) => (
          <div key={label} className="sb-card p-4 shadow-sm">
            <div className={`inline-flex p-2 rounded-xl mb-2 ${tone}`}>
              {icon({ size: 16 })}
            </div>
            <p className="sb-stat-value">{value}</p>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {[
            { value: 'stocks', label: 'Ações', count: stocks.length },
            { value: 'crypto', label: 'Criptomoedas', count: cryptos.length },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeType(item.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeType === item.value
                  ? 'sb-tab-active'
                  : 'sb-tab-inactive hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                activeType === item.value ? 'sb-badge-active' : 'sb-badge-inactive'
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Add form - collapsible */}
      <div className="sb-card rounded-3xl">
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="sb-collapse-trigger rounded-t-3xl"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <FiPlus size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Adicionar {isCrypto ? 'criptomoeda' : 'ação'}</p>
              <p className="text-xs text-gray-400">Busca automática · preço alvo opcional</p>
            </div>
          </div>
          {showAddForm ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
        </button>

        {showAddForm && (
          <form onSubmit={handleSubmit} className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-5 space-y-4 overflow-visible">
            {/* Quick picks */}
            {availableQuickPicks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                  <FiZap size={12} /> Atalhos rápidos
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableQuickPicks.map((asset) => (
                    <button
                      key={asset.coinId || asset.symbol}
                      type="button"
                      onClick={() => quickAdd(asset)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      {asset.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative z-20 min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {isCrypto ? 'Buscar cripto' : 'Buscar ticker'}
                </label>
                <div className="relative">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  <input
                    value={form.symbol}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        symbol: e.target.value.toUpperCase(),
                        coinId: '',
                        name: '',
                      });
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={isCrypto ? 'BTC, Ethereum...' : 'PETR4, VALE3...'}
                    required
                    className="w-full min-w-0 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
                {form.name && (
                  <p className="text-xs text-emerald-600 font-medium mt-1.5 break-words">
                    Selecionado: {form.symbol} · {form.name}
                  </p>
                )}
                {showSuggestions && (suggestions.length > 0 || searching) && (
                  <div className="absolute left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl max-h-56 overflow-y-auto overflow-x-hidden">
                    {searching && suggestions.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
                    )}
                    {suggestions.map((asset) => (
                      <button
                        key={asset.coinId || asset.symbol}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectAsset(asset)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-b border-gray-50 dark:border-gray-700 last:border-0 cursor-pointer min-w-0"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">{asset.symbol}</span>
                          <span className="block text-xs text-gray-400 truncate">{asset.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Preço alvo ({currency === 'usd' ? 'US$' : 'R$'})
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.targetPrice}
                    onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
                    placeholder="Opcional"
                    className="w-full min-w-0 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observação</label>
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ex: comprar na queda"
                    className="w-full min-w-0 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Salvando...' : (
                <>
                  <FiPlus size={16} /> Adicionar ao monitoramento
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* List toolbar */}
      {currentAssets.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Filtrar sua carteira..."
              className="sb-input pl-10 py-2.5"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sb-select"
          >
            <option value="change">Maior variação</option>
            <option value="target">Mais perto do alvo</option>
            <option value="name">Nome A-Z</option>
          </select>
        </div>
      )}

      {/* Asset cards */}
      {filteredAssets.length === 0 ? (
        <div className="sb-card rounded-3xl border-dashed dark:border-gray-600 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
            <FiActivity className="text-gray-300 dark:text-gray-600" size={26} />
          </div>
          <p className="text-gray-600 dark:text-gray-300 dark:text-gray-600 font-semibold">
            {listSearch
              ? 'Nenhum ativo encontrado com esse filtro'
              : isCrypto
                ? 'Sua lista de criptos está vazia'
                : 'Sua lista de ações está vazia'}
          </p>
          <p className="sb-subtitle mt-1">Use os atalhos ou a busca acima para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAssets.map((asset) => {
            const quote = asset.quote;
            const change = Number(quote?.changePercent || 0);
            const isUp = change >= 0;
            const targetInfo = getTargetProgress(quote?.price, asset.target_price);
            const hasQuote = quote?.price !== null && quote?.price !== undefined;

            return (
              <article
                key={`${activeType}-${asset.id}`}
                className={`relative sb-card rounded-3xl overflow-hidden hover:shadow-md transition-shadow ${
                  targetInfo?.reached ? 'border-emerald-200 dark:border-emerald-800' : ''
                }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasQuote ? (isUp ? 'bg-green-400' : 'bg-red-400') : 'bg-gray-200'}`} />

                <div className="p-6 pl-7">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-base font-black ${
                        isCrypto ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {asset.symbol?.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{asset.symbol}</h2>
                          {hasQuote && (
                            <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                              isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>
                              {isUp ? <FiTrendingUp size={11} /> : <FiTrendingDown size={11} />}
                              {Math.abs(change).toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{asset.name || quote?.name || 'Sem nome'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(asset.id)}
                      className="shrink-0 p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                      title="Remover"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-end justify-between gap-4 mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Cotação</p>
                      <p className="sb-price-lg">
                        {formatQuotePrice(
                          quote?.price,
                          isCrypto ? (quote?.currency || displayCurrency) : (quote?.currency || 'BRL')
                        )}
                      </p>
                    </div>
                    {asset.target_price && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Alvo</p>
                        <p className={`text-lg font-bold tabular-nums ${targetInfo?.reached ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-200'}`}>
                          {formatQuotePrice(asset.target_price, isCrypto ? displayCurrency : (quote?.currency || 'BRL'))}
                        </p>
                      </div>
                    )}
                  </div>

                  {targetInfo && asset.target_price && hasQuote && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] font-semibold text-gray-400 mb-1">
                        <span>Progresso até o alvo</span>
                        <span>{targetInfo.reached ? 'Atingido' : `${targetInfo.progress.toFixed(0)}%`}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            targetInfo.reached
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                              : 'bg-gradient-to-r from-amber-400 to-orange-400'
                          }`}
                          style={{ width: `${targetInfo.progress}%` }}
                        />
                      </div>
                      {!targetInfo.reached && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Faltam {formatQuotePrice(targetInfo.gap, isCrypto ? displayCurrency : (quote?.currency || 'BRL'))} para o alvo
                        </p>
                      )}
                    </div>
                  )}

                  {asset.note && (
                    <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                      {asset.note}
                    </p>
                  )}

                  {targetInfo?.reached && (
                    <p className="mt-3 text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <FiTarget size={12} /> Preço alvo atingido — boa oportunidade?
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
