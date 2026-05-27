import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiEdit2, FiLock, FiMail, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPassword() {
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveredVia, setDeliveredVia] = useState(null);
  const [availableChannels, setAvailableChannels] = useState({ telegram: false, email: false });
  const navigate = useNavigate();

  async function requestCode(prefer = null) {
    if (!email.trim()) {
      toast.error('Informe seu e-mail cadastrado');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', {
        email: email.trim(),
        ...(prefer ? { prefer } : {}),
      });
      const via = response.data.deliveredVia || null;
      setDeliveredVia(via);
      setAvailableChannels(response.data.availableChannels || { telegram: false, email: false });

      if (response.data.resetToken) {
        setToken(response.data.resetToken);
      } else {
        setToken('');
      }

      if (via === 'telegram') {
        toast.success('Código enviado pelo Telegram!', { icon: '📱', duration: 6000 });
      } else if (via === 'email') {
        toast.success('Código enviado para o seu e-mail!', { icon: '✉️', duration: 6000 });
      } else if (via === 'screen') {
        toast.success('Código gerado. Copie abaixo para continuar.');
      } else {
        toast.success(response.data.message || 'Se o e-mail existir, geramos um código.');
      }

      setStep('reset');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao solicitar recuperação');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestToken(e) {
    e.preventDefault();
    await requestCode();
  }

  function handleChangeEmail() {
    setStep('request');
    setToken('');
    setPassword('');
    setConfirmPassword('');
    setDeliveredVia(null);
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    if (!token.trim()) {
      toast.error('Informe o código recebido');
      return;
    }

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

  const stepBadge = (
    <div className="flex items-center gap-1 mb-5">
      <span className={`h-1.5 w-12 rounded-full ${step === 'request' ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
      <span className={`h-1.5 w-12 rounded-full ${step === 'reset' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
    </div>
  );

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
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-white font-bold">SB</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Recuperar senha</h1>
              <p className="text-sm text-gray-400">
                {step === 'request' ? 'Passo 1 de 2 — Envio do código' : 'Passo 2 de 2 — Nova senha'}
              </p>
            </div>
          </div>

          {stepBadge}

          {step === 'request' && (
            <form onSubmit={handleRequestToken} className="space-y-4">
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
                    autoFocus
                    className="sb-input pl-11 pr-4"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Enviaremos um código para o seu Telegram vinculado. Se não houver Telegram, vamos tentar o seu e-mail.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Enviando...' : (
                  <>
                    Enviar código <FiArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleChangeEmail}
                className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-300 hover:text-emerald-600 cursor-pointer"
              >
                <FiEdit2 size={12} /> Trocar e-mail ({email})
              </button>

              {deliveredVia === 'telegram' && (
                <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900">
                  <div className="flex items-start gap-3">
                    <FiSend className="shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" size={18} />
                    <div className="text-sm text-sky-800 dark:text-sky-100 leading-relaxed">
                      Enviamos o código para o seu Telegram. Abra o bot e cole o código abaixo.
                    </div>
                  </div>
                  {availableChannels.email && (
                    <button
                      type="button"
                      onClick={() => requestCode('email')}
                      disabled={loading}
                      className="mt-3 text-xs font-semibold text-sky-700 dark:text-sky-200 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                    >
                      Não tem acesso ao Telegram? Receber por e-mail
                    </button>
                  )}
                </div>
              )}

              {deliveredVia === 'email' && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900">
                  <div className="flex items-start gap-3">
                    <FiMail className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-300" size={18} />
                    <div className="text-sm text-emerald-800 dark:text-emerald-100 leading-relaxed">
                      Enviamos o código para o seu e-mail. Verifique a caixa de entrada e o spam.
                    </div>
                  </div>
                  {availableChannels.telegram && (
                    <button
                      type="button"
                      onClick={() => requestCode('telegram')}
                      disabled={loading}
                      className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-200 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                    >
                      Reenviar pelo Telegram
                    </button>
                  )}
                </div>
              )}

              {deliveredVia === 'screen' && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
                  <p className="text-sm text-amber-800 dark:text-amber-100 leading-relaxed">
                    Não há canal de envio configurado. O código foi preenchido automaticamente abaixo apenas para teste.
                  </p>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Código de recuperação</label>
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Cole aqui o código recebido"
                    required
                    autoFocus
                    className="sb-input tracking-widest font-bold text-center uppercase"
                  />
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
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>

                <button
                  type="button"
                  onClick={() => requestCode()}
                  disabled={loading}
                  className="w-full text-xs font-semibold text-gray-500 dark:text-gray-300 hover:text-emerald-600 cursor-pointer disabled:opacity-50"
                >
                  Não recebeu? Reenviar código
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
