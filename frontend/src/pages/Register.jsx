import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    const nameTrimmed = name.trim();
    const emailTrimmed = email.trim();

    if (nameTrimmed.length < 2) {
      toast.error('Informe seu nome completo (mínimo 2 caracteres)');
      return;
    }

    if (nameTrimmed.length > 100) {
      toast.error('O nome deve ter no máximo 100 caracteres');
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
      await register(nameTrimmed, emailTrimmed, password);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      {/* Lado esquerdo - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-emerald-500 to-emerald-600 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/20"></div>
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/10"></div>
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-white/10"></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-white font-bold text-lg">SB</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SmartBudget</h1>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Comece agora a<br />organizar seu dinheiro
          </h2>
          <p className="text-teal-100 text-lg max-w-md">
            Crie sua conta gratuitamente e tenha controle total sobre suas finanças pessoais.
          </p>
        </div>
        <div className="relative z-10 flex gap-6 text-sm">
          <div className="flex items-center gap-2 text-emerald-100">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
            Registre receitas e despesas
          </div>
          <div className="flex items-center gap-2 text-emerald-100">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
            Crie metas financeiras
          </div>
        </div>
      </div>

      {/* Lado direito - formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <span className="text-white font-bold">SB</span>
              </div>
              <h1 className="sb-title">SmartBudget</h1>
            </div>
            <p className="text-gray-500">Crie sua conta e comece a controlar seus gastos</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-8">
            <h2 className="sb-title mb-1">Criar conta</h2>
            <p className="sb-subtitle mb-7">Preencha seus dados para começar</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Nome completo</label>
                <div className="relative group">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    className="sb-input pl-11 pr-4"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">E-mail</label>
                <div className="relative group">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Senha</label>
                <div className="relative group">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="sb-input pl-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Confirmar senha</label>
                <div className="relative group">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    className="sb-input pl-11 pr-4"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 mt-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar conta
                    <FiArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                  Faça login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
