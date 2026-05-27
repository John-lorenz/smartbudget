import { useCallback, useEffect, useState } from 'react';
import { FiMessageCircle, FiCheck, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const LINKING_KEY = 'smartbudget_whatsapp_linking';

const COMMANDS = [
  { cmd: 'despesa 45,90 mercado', desc: 'Registra uma despesa hoje' },
  { cmd: 'receita 3500 salario', desc: 'Registra uma receita' },
  { cmd: 'meta viagem 10000', desc: 'Cria uma meta financeira' },
  { cmd: 'saldo', desc: 'Resumo do mês' },
  { cmd: 'ajuda', desc: 'Lista todos os comandos' },
];

function formatDisplayPhone(digits) {
  if (!digits) return '';
  const d = String(digits).replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return d;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function WhatsApp() {
  const { refreshUser } = useAuth();
  const [linkedPhone, setLinkedPhone] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const checkLinked = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const phone = data.user?.whatsapp_phone || '';
      if (phone) {
        setLinkedPhone(phone);
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
    checkLinked();
    if (sessionStorage.getItem(LINKING_KEY) === '1') {
      setLinking(true);
    }
  }, [checkLinked]);

  useEffect(() => {
    if (!linking || linkedPhone) return undefined;

    const interval = setInterval(() => {
      checkLinked().then((linked) => {
        if (linked) toast.success('WhatsApp vinculado!');
      });
    }, 2500);

    const timeout = setTimeout(() => {
      setLinking(false);
      sessionStorage.removeItem(LINKING_KEY);
    }, 1000 * 60 * 15);

    function onVisible() {
      if (document.visibilityState === 'visible') {
        checkLinked();
      }
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [linking, linkedPhone, checkLinked]);

  async function handleLink() {
    setLinking(true);
    sessionStorage.setItem(LINKING_KEY, '1');

    try {
      const { data } = await api.post('/auth/whatsapp/link-request');

      if (isMobileDevice()) {
        window.location.href = data.linkUrl;
      } else {
        window.open(data.linkUrl, '_blank', 'noopener,noreferrer');
        toast('Envie a mensagem no WhatsApp e volte aqui — vinculamos automaticamente.', {
          icon: '📱',
          duration: 6000,
        });
      }
    } catch (err) {
      setLinking(false);
      sessionStorage.removeItem(LINKING_KEY);
      toast.error(err.response?.data?.error || 'Não foi possível abrir o WhatsApp');
    }
  }

  async function handleUnlink() {
    if (!confirm('Desvincular este WhatsApp?')) return;
    setUnlinking(true);
    try {
      await api.delete('/auth/whatsapp');
      setLinkedPhone('');
      toast.success('WhatsApp desvinculado');
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
        <p className="text-xs font-bold uppercase tracking-wider text-green-600 mb-1">Assistente</p>
        <h1 className="sb-title">WhatsApp</h1>
        <p className="sb-subtitle mt-1">
          Registre despesas, receitas e metas pelo WhatsApp, sem abrir o app.
        </p>
      </div>

      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-green-500/20">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-white/20">
            <FiMessageCircle size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg">Vincular em um toque</h2>
            <p className="text-white/85 text-sm mt-1 leading-relaxed">
              Toque em <strong>Vincular WhatsApp</strong>, envie a mensagem pronta no chat e pronto —
              usamos o número do seu WhatsApp automaticamente.
            </p>
          </div>
        </div>
      </div>

      <div className="sb-card p-5 shadow-sm space-y-4">
        {linkedPhone ? (
          <>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <FiCheck size={18} />
              Vinculado: {formatDisplayPhone(linkedPhone)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Envie comandos direto para o bot do SmartBudget no WhatsApp.
            </p>
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
                ? 'Aguardando você enviar a mensagem no WhatsApp…'
                : 'O app abre o WhatsApp com a mensagem de vínculo. Basta enviar.'}
            </p>
            <button
              type="button"
              onClick={handleLink}
              disabled={linking}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-md disabled:opacity-70 cursor-pointer"
            >
              {linking ? (
                <>
                  <FiLoader size={18} className="animate-spin" />
                  Aguardando confirmação…
                </>
              ) : (
                <>
                  <FiMessageCircle size={18} />
                  Vincular WhatsApp
                </>
              )}
            </button>
            {linking && (
              <p className="text-xs text-gray-400">
                Depois de enviar, volte a esta aba. A vinculação é automática.
              </p>
            )}
          </>
        )}
      </div>

      <div className="sb-card p-5 shadow-sm">
        <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-3">Comandos</h2>
        <ul className="space-y-3">
          {COMMANDS.map(({ cmd, desc }) => (
            <li
              key={cmd}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-b border-gray-50 dark:border-gray-700 pb-3 last:border-0 last:pb-0"
            >
              <code className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg shrink-0">
                {cmd}
              </code>
              <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
