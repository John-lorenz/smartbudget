import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${
        isDark
          ? 'text-amber-200 bg-gray-800 hover:bg-gray-700 border border-gray-600'
          : 'text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200'
      } ${className}`}
      title={isDark ? 'Modo claro' : 'Modo noturno'}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo noturno'}
    >
      {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
      <span className="hidden sm:inline">{isDark ? 'Claro' : 'Noturno'}</span>
    </button>
  );
}
