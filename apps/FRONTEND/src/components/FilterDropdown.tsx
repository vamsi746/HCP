import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  icon?: React.ReactNode;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchable?: boolean;
  variant?: 'pill' | 'form';
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ icon, options, value, onChange, placeholder, searchable, variant = 'pill' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;
  const isActive = value !== '';

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  const isForm = variant === 'form';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={isForm
          ? `w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] border transition-all cursor-pointer select-none ${
              open
                ? 'border-[#003366] ring-2 ring-[#003366]/20'
                : 'border-[#D9DEE4] hover:border-[#003366]/30'
            } ${isActive ? 'text-[#1C2334] font-semibold' : 'text-[#718096]'}`
          : `inline-flex items-center gap-1.5 pl-3 pr-2 py-[7px] rounded-lg text-[12px] font-semibold transition-all cursor-pointer select-none ${
              isActive
                ? 'bg-[#003366] text-white shadow-[0_2px_8px_rgba(0,51,102,0.25)]'
                : 'bg-white text-[#1C2334] shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20'
            }`
        }
      >
        {icon && <span className={isForm ? 'opacity-50' : (isActive ? 'opacity-80' : 'opacity-40')}>{icon}</span>}
        <span className={isForm ? 'truncate flex-1 text-left' : 'truncate max-w-[180px]'}>{selectedLabel}</span>
        <ChevronDown size={isForm ? 14 : 12} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isForm ? 'text-[#718096]' : (isActive ? 'opacity-60' : 'opacity-40')}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1.5 z-50 bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-neutral-200/80 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${
          isForm ? 'w-full min-w-0' : 'min-w-[220px] w-max max-w-[380px]'
        }`}>
          {searchable && (
            <div className="px-2.5 pt-2.5 pb-1.5">
              <div className="flex items-center gap-2 bg-[#F4F5F7] rounded-md px-2.5 py-2">
                <Search size={13} className="text-[#718096] flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-[12px] bg-transparent focus:outline-none w-full text-[#1C2334] placeholder:text-[#A0AEC0]"
                />
              </div>
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto py-1 scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: '#D9DEE4 transparent' }}>
            {/* Placeholder / All option */}
            <button
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between gap-2 transition-colors ${
                value === ''
                  ? 'bg-[#003366]/[0.06] text-[#003366] font-bold'
                  : 'text-[#4A5568] hover:bg-[#F4F5F7]'
              }`}
            >
              <span>{placeholder}</span>
              {value === '' && <Check size={13} className="text-[#003366] flex-shrink-0" />}
            </button>

            {filtered.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between gap-2 transition-colors ${
                  value === opt.value
                    ? 'bg-[#003366]/[0.06] text-[#003366] font-bold'
                    : 'text-[#1C2334] hover:bg-[#F4F5F7]'
                }`}
              >
                <span className="break-words">{opt.label}</span>
                {value === opt.value && <Check size={13} className="text-[#003366] flex-shrink-0" />}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[12px] text-[#A0AEC0]">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
