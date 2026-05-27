import { useState, useEffect } from 'react';
import api from '../services/api';
import { FiPlus, FiTrash2, FiEdit2, FiX, FiTarget, FiCalendar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import DateField from '../components/DateField';
import { displayDateToIso, formatDateForDisplay } from '../utils/date';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    target_amount: '',
    current_amount: '',
    deadline: '',
  });

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch (err) {
      console.error('Erro ao carregar metas:', err);
    } finally {
      setLoading(false);
    }
  }

  function openModal(goal = null) {
    if (goal) {
      setEditingId(goal.id);
      setForm({
        title: goal.title,
        target_amount: String(goal.target_amount),
        current_amount: String(goal.current_amount),
        deadline: formatDateForDisplay(goal.deadline),
      });
    } else {
      setEditingId(null);
      setForm({ title: '', target_amount: '', current_amount: '', deadline: '' });
    }
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const deadline = form.deadline ? displayDateToIso(form.deadline) : null;

      if (form.deadline && !deadline) {
        toast.error('Informe o prazo no formato DD/MM/AAAA');
        setSaving(false);
        return;
      }

      const data = {
        ...form,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount) || 0,
        deadline,
      };

      if (editingId) {
        await api.put(`/goals/${editingId}`, data);
        toast.success('Meta atualizada!');
      } else {
        await api.post('/goals', data);
        toast.success('Meta criada com sucesso!');
      }
      setShowModal(false);
      loadGoals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar meta');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
    try {
      await api.delete(`/goals/${id}`);
      toast.success('Meta excluída');
      loadGoals();
    } catch {
      toast.error('Erro ao excluir meta');
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
          <span className="text-sm text-gray-400">Carregando metas...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="sb-title">Metas Financeiras</h1>
          <p className="sb-subtitle mt-1">Acompanhe seu progresso rumo aos seus objetivos</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all cursor-pointer"
        >
          <FiPlus size={16} /> Nova meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="sb-card p-14 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <FiTarget className="text-gray-300 dark:text-gray-600" size={28} />
          </div>
          <p className="text-gray-500 font-medium mb-1">Nenhuma meta criada ainda</p>
          <p className="sb-subtitle mb-4">Defina objetivos financeiros e acompanhe seu progresso</p>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:text-emerald-700 cursor-pointer"
          >
            <FiPlus size={16} /> Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const progress = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100);
            const isComplete = progress >= 100;
            const deadlinePassed = g.deadline && new Date(g.deadline) < new Date();

            return (
              <div key={g.id} className="sb-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isComplete ? 'bg-green-50' : 'bg-gradient-to-br from-emerald-50 to-teal-50'}`}>
                      <FiTarget className={isComplete ? 'text-green-600' : 'text-emerald-600'} size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">{g.title}</h3>
                      {g.deadline && (
                        <div className={`flex items-center gap-1 mt-0.5 text-[11px] font-medium ${deadlinePassed && !isComplete ? 'text-red-500' : 'text-gray-400'}`}>
                          <FiCalendar size={10} />
                          {formatDateForDisplay(g.deadline)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => openModal(g)}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                    >
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400 font-medium">Progresso</span>
                    <span className={`font-bold ${isComplete ? 'text-green-600' : 'text-emerald-600'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    Atual: <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(g.current_amount)}</span>
                  </span>
                  <span className="text-gray-400">
                    Meta: <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(g.target_amount)}</span>
                  </span>
                </div>

                {isComplete && (
                  <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-center">
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">Meta alcançada!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="sb-modal-overlay">
          <div className="sb-modal animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {editingId ? 'Editar meta' : 'Nova meta'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Título da meta</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Viagem de férias"
                  required
                  className="sb-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Valor alvo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  placeholder="5000,00"
                  required
                  className="sb-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Valor atual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.current_amount}
                  onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                  placeholder="0,00"
                  className="sb-input"
                />
              </div>

              <DateField
                label="Prazo (opcional)"
                value={form.deadline}
                onChange={(deadline) => setForm({ ...form, deadline })}
              />

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
                  editingId ? 'Salvar alterações' : 'Criar meta'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
