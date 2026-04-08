import { useState, useEffect } from 'react';
import api from '../services/api';
import { FiPlus, FiTrash2, FiEdit2, FiX, FiFilter, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação',
  'Lazer', 'Vestuário', 'Salário', 'Trabalhos autônomos', 'Investimentos', 'Outros',
];

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState({
    type: 'despesa',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadTransactions();
  }, [filterType]);

  async function loadTransactions() {
    try {
      const params = {};
      if (filterType) params.type = filterType;
      const res = await api.get('/transactions', { params });
      setTransactions(res.data);
    } catch (err) {
      console.error('Erro ao carregar transações:', err);
    } finally {
      setLoading(false);
    }
  }

  function openModal(transaction = null) {
    if (transaction) {
      setEditingId(transaction.id);
      setForm({
        type: transaction.type,
        amount: String(transaction.amount),
        category: transaction.category,
        description: transaction.description || '',
        date: transaction.date.split('T')[0],
      });
    } else {
      setEditingId(null);
      setForm({
        type: 'despesa',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await api.put(`/transactions/${editingId}`, data);
        toast.success('Transação atualizada!');
      } else {
        await api.post('/transactions', data);
        toast.success('Transação registrada!');
      }
      setShowModal(false);
      loadTransactions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar transação');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transação excluída');
      loadTransactions();
    } catch {
      toast.error('Erro ao excluir transação');
    }
  }

  function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-emerald-200 border-t-emerald-600"></div>
          <span className="text-sm text-gray-400">Carregando transações...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Transações</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie suas receitas e despesas</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all cursor-pointer"
        >
          <FiPlus size={16} /> Nova transação
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-5">
        <FiFilter size={14} className="text-gray-400" />
        <div className="flex bg-gray-100 rounded-xl p-0.5">
          {[
            { value: '', label: 'Todas' },
            { value: 'receita', label: 'Receitas' },
            { value: 'despesa', label: 'Despesas' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === opt.value
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FiDollarSign className="text-gray-300" size={28} />
          </div>
          <p className="text-gray-500 font-medium mb-1">Nenhuma transação encontrada</p>
          <p className="text-gray-400 text-sm mb-4">Comece registrando sua primeira transação</p>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:text-emerald-700 cursor-pointer"
          >
            <FiPlus size={16} /> Adicionar transação
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Header da tabela - desktop */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            <div className="col-span-1">Tipo</div>
            <div className="col-span-3">Descrição</div>
            <div className="col-span-2">Categoria</div>
            <div className="col-span-2">Data</div>
            <div className="col-span-2 text-right">Valor</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>

          {transactions.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center transition-colors"
            >
              <div className="sm:col-span-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${t.type === 'receita' ? 'bg-green-400' : 'bg-red-400'}`}></span>
              </div>
              <div className="sm:col-span-3">
                <p className="text-sm font-medium text-gray-700">{t.description || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[11px] font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg">{t.category}</span>
              </div>
              <div className="sm:col-span-2 text-sm text-gray-400">
                {new Date(t.date).toLocaleDateString('pt-BR')}
              </div>
              <div className={`sm:col-span-2 text-sm font-bold text-right ${t.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
              </div>
              <div className="sm:col-span-2 flex justify-end gap-1">
                <button
                  onClick={() => openModal(t)}
                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                >
                  <FiEdit2 size={15} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? 'Editar transação' : 'Nova transação'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'despesa' })}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      form.type === 'despesa'
                        ? 'bg-red-50 text-red-600 ring-2 ring-red-200'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'receita' })}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      form.type === 'receita'
                        ? 'bg-green-50 text-green-600 ring-2 ring-green-200'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 focus:bg-white transition-all"
                >
                  <option value="">Selecione...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descrição (opcional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Almoço no restaurante"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Salvando...
                  </>
                ) : (
                  editingId ? 'Salvar alterações' : 'Registrar transação'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
