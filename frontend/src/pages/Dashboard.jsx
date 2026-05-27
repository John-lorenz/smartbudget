import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiTarget,
  FiPlus,
  FiArrowRight,
  FiPieChart,
} from 'react-icons/fi';
import { formatDateForDisplay } from '../utils/date';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({ total_receitas: 0, total_despesas: 0, saldo: 0 });
  const [indicators, setIndicators] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryRes, indicatorsRes, transactionsRes, goalsRes] = await Promise.all([
          api.get('/transactions/summary'),
          api.get('/transactions/indicators'),
          api.get('/transactions'),
          api.get('/goals'),
        ]);
        setSummary(summaryRes.data);
        setIndicators(indicatorsRes.data);
        setRecentTransactions(transactionsRes.data.slice(0, 5));
        setGoals(goalsRes.data.slice(0, 3));
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-emerald-200 border-t-emerald-600"></div>
          <span className="text-sm text-gray-400">Carregando dados...</span>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Receitas',
      value: summary.total_receitas,
      icon: FiTrendingUp,
      color: 'green',
      gradient: 'from-green-500 to-emerald-600',
      bg: 'sb-icon-green',
      text: 'text-green-700 dark:text-green-400',
    },
    {
      label: 'Despesas',
      value: summary.total_despesas,
      icon: FiTrendingDown,
      color: 'red',
      gradient: 'from-red-500 to-rose-600',
      bg: 'sb-icon-red',
      text: 'text-red-700 dark:text-red-400',
    },
    {
      label: 'Saldo',
      value: summary.saldo,
      icon: FiDollarSign,
      color: 'emerald',
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'sb-icon-emerald',
      text: Number(summary.saldo) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
    },
  ];

  const expenseVariation = indicators?.expenseVariation;
  const savingsRate = Number(indicators?.savingsRate || 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="sb-title">
          Olá, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="sb-subtitle mt-1">Resumo das suas finanças neste mês</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {summaryCards.map(({ label, value, icon, bg, text }) => (
          <div key={label} className="sb-card p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{label}</span>
              <div className={`p-2 rounded-xl ${bg}`}>
                {icon({ className: text, size: 18 })}
              </div>
            </div>
            <p className={`text-2xl font-bold ${text}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Indicadores do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="sb-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Saldo do mês</span>
            <div className="p-2 rounded-xl sb-icon-emerald">
              <FiDollarSign size={18} />
            </div>
          </div>
          <p className={`text-xl font-bold ${Number(indicators?.currentMonth?.saldo || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatCurrency(indicators?.currentMonth?.saldo || 0)}
          </p>
        </div>

        <div className="sb-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Variação de gastos</span>
            <div className="p-2 rounded-xl sb-icon-red">
              <FiTrendingDown size={18} />
            </div>
          </div>
          <p className={`text-xl font-bold ${expenseVariation !== null && expenseVariation <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {expenseVariation === null || expenseVariation === undefined ? 'Sem base' : `${expenseVariation.toFixed(1)}%`}
          </p>
        </div>

        <div className="sb-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Maior gasto</span>
            <div className="p-2 rounded-xl sb-icon-gray">
              <FiPieChart size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {indicators?.topExpenseCategory?.category || 'Sem gastos'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Taxa de economia: {savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link
          to="/transactions"
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
        >
          <FiPlus size={16} /> Nova transação
        </Link>
        <Link
          to="/goals"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 transition-all"
        >
          <FiTarget size={16} /> Nova meta
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transações recentes */}
        <div className="sb-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 dark:text-gray-100">Transações Recentes</h2>
            <Link to="/transactions" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
              Ver todas <FiArrowRight size={12} />
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                <FiDollarSign className="text-gray-300 dark:text-gray-600" size={24} />
              </div>
              <p className="sb-subtitle mb-1">Nenhuma transação registrada</p>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                <FiPlus size={14} /> Adicionar transação
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${t.type === 'receita' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.description || t.category}</p>
                      <p className="text-[11px] text-gray-400">{t.category} · {formatDateForDisplay(t.date)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${t.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metas */}
        <div className="sb-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 dark:text-gray-100">Metas</h2>
            <Link to="/goals" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
              Ver todas <FiArrowRight size={12} />
            </Link>
          </div>
          {goals.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                <FiTarget className="text-gray-300 dark:text-gray-600" size={24} />
              </div>
              <p className="sb-subtitle mb-1">Nenhuma meta criada</p>
              <Link
                to="/goals"
                className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                <FiPlus size={14} /> Criar meta
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => {
                const progress = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100);
                return (
                  <div key={g.id} className="p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{g.title}</span>
                      <span className="font-bold text-emerald-600">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
