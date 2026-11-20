import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * Componente Selector Flotante con Búsqueda Integrada para Tipos de Contrato y Códigos de Planilla.
 * - Identidad Chavín: Azul Marino, Azul Acero, Turquesa y Verde Petróleo.
 * - Sin amarillo ni naranja.
 * - Alto contraste y legibilidad.
 */
export default function ContractOptionSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Seleccionar...',
  compact = false,
  className = '',
  disabled = false,
  ariaLabel = 'Selector de opciones'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalizar valor seleccionado
  const selectedItem = options.find(
    opt => String(opt.code).toUpperCase() === String(value).toUpperCase()
  );

  // Filtrado reactivo por código o descripción
  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    const codeMatch = String(opt.code).toLowerCase().includes(term);
    const descMatch = String(opt.description).toLowerCase().includes(term);
    return codeMatch || descMatch;
  });

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Enfocar input de búsqueda al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    setHighlightedIndex(0);
  }, [isOpen]);

  // Manejo de teclado
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].code);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleSelect = (code) => {
    if (onChange) {
      onChange(code);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('');
    }
    setSearchTerm('');
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Botón Trigger de Apertura */}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left transition-all border rounded-lg ${
          compact ? 'px-2 py-1 text-xs h-8' : 'px-3 py-2 text-sm h-10'
        } ${
          disabled 
            ? 'opacity-50 cursor-not-allowed bg-slate-800/50 text-slate-400 border-slate-700' 
            : 'bg-slate-800 hover:bg-slate-700/90 cursor-pointer text-white border-slate-600 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 shadow-sm'
        } ${selectedItem ? 'font-medium' : 'text-slate-400'}`}
      >
        <span className="truncate pr-1">
          {selectedItem ? (
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-200 font-mono text-[11px] font-bold border border-teal-500/50">
                {selectedItem.code}
              </span>
              {!compact && <span className="truncate text-slate-100">{selectedItem.description}</span>}
            </span>
          ) : (
            placeholder
          )}
        </span>

        <span className="flex items-center gap-1 flex-shrink-0 text-slate-400">
          {value && !disabled && (
            <span
              onClick={handleClear}
              title="Limpiar"
              className="hover:text-rose-400 p-0.5 rounded hover:bg-slate-700 transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
        </span>
      </button>

      {/* Menú Desplegable Flotante */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-80 max-w-[90vw] bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 left-0"
        >
          {/* Barra de Búsqueda */}
          <div className="p-2.5 border-b border-slate-700 bg-slate-850 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Buscar por código o nombre..."
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Lista de Opciones */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-800"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-xs text-slate-400 text-center italic">
                No se encontraron opciones coincidentes
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedItem && selectedItem.code === opt.code;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={opt.code}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.code)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
                      isHighlighted
                        ? 'bg-cyan-500/20 text-cyan-100'
                        : isSelected
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-200 hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-teal-900/60 border border-teal-500/40 text-teal-200 flex-shrink-0">
                      {opt.code}
                    </span>
                    <span className="flex-1 leading-tight text-slate-200">
                      {opt.description}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer de navegación rápida */}
          <div className="px-3 py-1.5 bg-slate-850 border-t border-slate-700 text-[10px] text-slate-400 flex justify-between font-mono">
            <span>{filteredOptions.length} opción(es)</span>
            <span>Usa ⇅ flechas + Enter</span>
          </div>
        </div>
      )}
    </div>
  );
}
