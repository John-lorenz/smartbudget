import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiLock, FiMail } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleRequestToken(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() });
      if (response.data.resetToken) {
        setToken(response.data.resetToken);
      }
      toast.success(response.data.message || 'Solicitação enviada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao solicitar recuperação');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token: token.trim(), password });
      toast.success('Senha redefinida com sucesso!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 mb-5">
          <FiArrowLeft size={16} /> Voltar para login
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-white font-bold">SB</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Recuperar senha</h1>
              <p className="text-sm text-gray-400">Gere um código e defina uma nova senha</p>
            </div>
          </div>

          <form onSubmit={handleRequestToken} className="space-y-4 pb-6 border-b border-gray-100">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">E-mail cadastrado</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="sb-input pl-11 pr-4"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              Gerar código <FiArrowRight size={16} />
            </button>
          </form>

          <form onSubmit={handleResetPassword} className="space-y-4 pt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Código de recuperação</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole o código recebido"
                required
                className="sb-input"
              />
              {token && (
                <p className="text-xs text-gray-400 mt-2">
                  Para a entrega acadêmica, o código é exibido no app porque não há envio de e-mail configurado.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Nova senha</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="sb-input pl-11 pr-4"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="sb-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition-all disabled:opacity-50 cursor-pointer"
            >
              Redefinir senha
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
