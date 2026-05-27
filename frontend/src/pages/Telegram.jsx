import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiLoader, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const LINKING_KEY = 'smartbudget_telegram_linking';

const COMMANDS = [
  { cmd: 'gastei 45,90 no mercado', desc: 'Registra despesa com linguagem natural' },
  { cmd: 'despesa 25 uber ontem', desc: 'Registra despesa em data anterior' },
  { cmd: 'recebi 3500 salario', desc: 'Registra uma receita' },
  { cmd: 'meta viagem 10000', desc: 'Cria uma meta financeira' },
  { cmd: 'saldo', desc: 'Resumo do mês' },
  { cmd: 'hoje', desc: 'Resumo dos lançamentos de hoje' },
  { cmd: 'extrato', desc: 'Mostra as 5 últimas transações' },
  { cmd: 'desfazer', desc: 'Apaga a última transação registrada' },
];

export default function Telegram() {
  const { refreshUser } = useAuth();
  const [linked, setLinked] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const checkLinked = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const isLinked = Boolean(data.user?.telegram_chat_id);
      setLinked(isLinked);
      if (isLinked) {
        setLinking(false);
        sessionStorage.removeItem(LINKING_KEY);
        await refreshUser?.();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [refreshUser]);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, infoRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/telegram/info'),
        ]);
        setLinked(Boolean(meRes.data.user?.telegram_chat_id));
        setBotUsername(infoRes.data.username || '');
      } catch {
        // ignore
      }
    }
    load();
    if (sessionStorage.getItem(LINKING_KEY) === '1') {
      setLinking(true);
    }
  }, [checkLinked]);

  useEffect(() => {
    if (!linking || linked) return undefined;

    const interval = setInterval(() => {
      checkLinked().then((ok) => {
        if (ok) toast.success('Telegram vinculado!');
      });
    }, 2500);

    const timeout = setTimeout(() => {
      setLinking(false);
      sessionStorage.removeItem(LINKING_KEY);
    }, 1000 * 60 * 15);

    function onVisible() {
      if (document.visibilityState === 'visible') checkLinked();
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [linking, linked, checkLinked]);

  async function handleLink() {
    setLinking(true);
    sessionStorage.setItem(LINKING_KEY, '1');

    try {
      const { data } = await api.post('/auth/telegram/link-request');
      window.open(data.linkUrl, '_blank', 'noopener,noreferrer');
      toast('No Telegram, toque em *Iniciar* e volte aqui.', { icon: '📱', duration: 6000 });
      if (data.botUsername) setBotUsername(data.botUsername);
    } catch (err) {
      setLinking(false);
      sessionStorage.removeItem(LINKING_KEY);
      toast.error(err.response?.data?.error || 'Não foi possível abrir o Telegram');
    }
  }

  async function handleUnlink() {
    if (!confirm('Desvincular o Telegram?')) return;
    setUnlinking(true);
    try {
      await api.delete('/auth/telegram');
      setLinked(false);
      toast.success('Telegram desvinculado');
      await refreshUser?.();
    } catch {
      toast.error('Erro ao desvincular');
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-sky-500 mb-1">Assistente</p>
        <h1 className="sb-title">Telegram</h1>
        <p className="sb-subtitle mt-1">
          Registre despesas, receitas e metas pelo Telegram — sem número extra.
        </p>
      </div>

      <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-sky-500/20">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-white/20">
            <FiSend size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg">Vincular em um toque</h2>
            <p className="text-white/85 text-sm mt-1 leading-relaxed">
              Toque em <strong>Vincular Telegram</strong>, abra o bot
              {botUsername ? ` @${botUsername}` : ''} e pressione <strong>Iniciar</strong>.
              Não precisa de chip nem outro WhatsApp.
            </p>
          </div>
        </div>
      </div>

      <div className="sb-card p-5 shadow-sm space-y-4">
        {linked ? (
          <>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <FiCheck size={18} />
              Telegram vinculado à sua conta
            </p>
            {botUsername && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Bot: @{botUsername}
              </p>
            )}
            <button
              type="button"
              onClick={handleUnlink}
              disabled={unlinking}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
            >
              {unlinking ? 'Desvinculando...' : 'Desvincular'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {linking
                ? 'Aguardando você tocar em Iniciar no Telegram…'
                : 'O app abre o Telegram com o link de vínculo pronto.'}
            </p>
            <button
              type="button"
              onClick={handleLink}
              disabled={linking}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-md disabled:opacity-70 cursor-pointer"
            >
              {linking ? (
                <>
                  <FiLoader size={18} className="animate-spin" />
                  Aguardando confirmação…
                </>
              ) : (
                <>
                  <FiSend size={18} />
                  Vincular Telegram
                </>
              )}
            </button>
          </>
        )}
      </div>

      <div className="sb-card p-5 shadow-sm">
        <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-3">Comandos</h2>
        <ul className="space-y-3">
          {COMMANDS.map(({ cmd, desc }) => (
            <li
              key={cmd}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0"
            >
              <code className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-1 rounded-lg shrink-0">
                {cmd}
              </code>
              <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
        Configure o bot no @BotFather e defina <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">TELEGRAM_BOT_TOKEN</code>
        {' '}e <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">TELEGRAM_BOT_USERNAME</code> no backend.
        Depois do deploy, acesse <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/telegram/setup</code> uma vez para registrar o webhook.
      </p>
    </div>
  );
}
