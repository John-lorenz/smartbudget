import { useRef } from 'react';
import { FiCalendar } from 'react-icons/fi';
import { displayDateToIso, formatDateForDisplay, formatDateInput } from '../utils/date';

export default function DateField({ label, value, onChange, className = '', required = false }) {
  const dateInputRef = useRef(null);
  const isoValue = displayDateToIso(value) || '';

  function handleTextChange(text) {
    onChange(formatDateInput(text));
  }

  function handleCalendarChange(iso) {
    if (!iso) {
      onChange('');
      return;
    }
    onChange(formatDateForDisplay(iso));
  }

  function openCalendar() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="sb-label mb-1.5">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            e.stopPropagation();
            handleTextChange(e.target.value);
          }}
          onDoubleClick={openCalendar}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          inputMode="numeric"
          required={required}
          className="sb-input pl-4 pr-11"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCalendar();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
          title="Abrir calendário"
          tabIndex={-1}
        >
          <FiCalendar size={18} />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={isoValue}
          onChange={(e) => handleCalendarChange(e.target.value)}
          tabIndex={-1}
          aria-hidden
          className="absolute bottom-0 right-2 w-8 h-8 opacity-0 pointer-events-none"
        />
      </div>
    </div>
  );
}
