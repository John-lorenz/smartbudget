import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBarChart2, FiCalendar, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import DateField from '../components/DateField';
import { displayDateToIso, getFirstDayOfMonthDisplayDate, getTodayDisplayDate } from '../utils/date';
import { transactionLabel } from '../utils/text';

export default function Reports() {
  const [filters, setFilters] = useState({
    startDate: getFirstDayOfMonthDisplayDate(),
    endDate: getTodayDisplayDate(),
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport(nextFilters = filters) {
    setLoading(true);
    try {
      const params = {
        startDate: nextFilters.startDate ? displayDateToIso(nextFilters.startDate) : undefined,
        endDate: nextFilters.endDate ? displayDateToIso(nextFilters.endDate) : undefined,
      };

      if ((nextFilters.startDate && !params.startDate) || (nextFilters.endDate && !params.endDate)) {
        toast.error('Use datas no formato DD/MM/AAAA');
        return;
      }

      const response = await api.get('/transactions/report', { params });
      setReport(response.data);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    loadReport(filters);
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatMonth(month) {
    if (!month) return '';
    const [year, monthNumber] = month.split('-');
    return `${monthNumber}/${year}`;
  }

  const groupedCategories = useMemo(() => {
    const receitas = report?.byCategory?.filter((item) => item.type === 'receita') || [];
    const despesas = report?.byCategory?.filter((item) => item.type === 'despesa') || [];
    return { receitas, despesas };
  }, [report]);

  const analytics = useMemo(() => {
    if (!report) return null;

    const income = Number(report.totals.total_receitas || 0);
    const expenses = Number(report.totals.total_despesas || 0);
    const balance = Number(report.totals.saldo || 0);
    const transactions = Number(report.totals.total_transacoes || 0);
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    const averageTransaction = transactions > 0 ? (income + expenses) / transactions : 0;
    const topExpense = groupedCategories.despesas[0] || null;
    const topIncome = groupedCategories.receitas[0] || null;
    const maxCategoryTotal = Math.max(
      ...report.byCategory.map((item) => Number(item.total || 0)),
      1
    );
    const maxMonthlyTotal = Math.max(
      ...report.byMonth.map((item) => Math.max(Number(item.receitas || 0), Number(item.despesas || 0))),
      1
    );

    return {
      income,
      expenses,
      balance,
      transactions,
      savingsRate,
      averageTransaction,
      topExpense,
      topIncome,
      maxCategoryTotal,
      maxMonthlyTotal,
    };
  }, [groupedCategories, report]);

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-emerald-200 border-t-emerald-600"></div>
          <span className="text-sm text-gray-400">Gerando relatório...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="sb-title">Relatórios</h1>
          <p className="sb-subtitle mt-0.5">Receitas, despesas e saldo por período</p>
        </div>
        <Link
          to="/telegram"
          className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-green-500/20 hover:bg-green-700 transition-all"
        >
          <FiSend size={16} /> Usar pelo Telegram
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="sb-card p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <DateField
            label="Data inicial"
            value={filters.startDate}
            onChange={(startDate) => setFilters({ ...filters, startDate })}
          />
          <DateField
            label="Data final"
            value={filters.endDate}
            onChange={(endDate) => setFilters({ ...filters, endDate })}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <FiCalendar size={16} /> Atualizar
          </button>
        </div>
      </form>

      {report && analytics && (
        <>
          <div className={`rounded-2xl p-5 md:p-6 shadow-sm overflow-hidden relative ${
            analytics.balance >= 0
              ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600'
              : 'bg-gradient-to-br from-red-500 via-rose-600 to-orange-500'
          }`}>
            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-white/10" />
            <div className="relative">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Resultado do período</p>
              <p className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
                {formatCurrency(analytics.balance)}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { label: 'Receitas', value: formatCurrency(analytics.income) },
                  { label: 'Despesas', value: formatCurrency(analytics.expenses) },
                  { label: 'Economia', value: `${analytics.savingsRate.toFixed(1)}%` },
                  { label: 'Transações', value: String(analytics.transactions) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-white/20 backdrop-blur px-4 py-3.5 min-h-[72px] flex flex-col justify-center">
                    <p className="text-white/75 text-[11px] font-semibold uppercase tracking-wide">{label}</p>
                    <p className="text-white font-bold text-base md:text-lg mt-0.5 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Receitas por categoria', data: groupedCategories.receitas, color: 'text-green-600', bar: 'from-green-400 to-emerald-500' },
                { title: 'Despesas por categoria', data: groupedCategories.despesas, color: 'text-red-500', bar: 'from-red-400 to-rose-500' },
              ].map(({ title, data, color, bar }) => (
                <div key={title} className="sb-card p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h2>
                  {data.length === 0 ? (
                    <p className="text-sm text-gray-400 mt-3">Nenhum lançamento no período.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {data.map((item) => (
                        <li key={`${item.type}-${item.category}`}>
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{item.category}</p>
                              <p className="text-[11px] text-gray-400">{transactionLabel(item.quantidade)}</p>
                            </div>
                            <span className={`text-sm font-bold shrink-0 ${color}`}>{formatCurrency(item.total)}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-2 rounded-full bg-gradient-to-r ${bar}`}
                              style={{ width: `${Math.max((Number(item.total) / analytics.maxCategoryTotal) * 100, 4)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="sb-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-indigo-50">
                  <FiBarChart2 className="text-indigo-600" size={18} />
                </div>
                <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Leitura rápida</h2>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                  <dt className="text-gray-400">Maior despesa</dt>
                  <dd className="font-semibold text-gray-800 dark:text-gray-100 text-right">
                    {analytics.topExpense ? analytics.topExpense.category : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                  <dt className="text-gray-400">Maior receita</dt>
                  <dd className="font-semibold text-gray-800 dark:text-gray-100 text-right">
                    {analytics.topIncome ? analytics.topIncome.category : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                  <dt className="text-gray-400">Média / lançamento</dt>
                  <dd className="font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(analytics.averageTransaction)}</dd>
                </div>
                <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${analytics.balance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {analytics.balance >= 0
                    ? 'Período fechado no positivo.'
                    : 'Despesas superaram as receitas.'}
                </div>
              </dl>
            </div>
          </div>

          <div className="sb-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Evolução mensal</h2>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500" />Receitas</span>
                <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-500" />Despesas</span>
              </div>
            </div>

            {report.byMonth.length === 0 ? (
              <p className="text-sm text-gray-400">Sem dados mensais para exibir.</p>
            ) : (
              <div className="space-y-3">
                {report.byMonth.map((month) => (
                  <div key={month.month} className="grid grid-cols-[56px_1fr] gap-3 items-center">
                    <span className="text-xs font-bold text-gray-500">{formatMonth(month.month)}</span>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                            style={{ width: `${Math.max((Number(month.receitas) / analytics.maxMonthlyTotal) * 100, Number(month.receitas) > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-[11px] font-bold text-green-600 tabular-nums">{formatCurrency(month.receitas)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-red-400 to-rose-500"
                            style={{ width: `${Math.max((Number(month.despesas) / analytics.maxMonthlyTotal) * 100, Number(month.despesas) > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-[11px] font-bold text-red-500 tabular-nums">{formatCurrency(month.despesas)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
