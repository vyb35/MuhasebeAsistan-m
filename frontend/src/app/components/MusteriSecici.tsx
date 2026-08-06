// src/app/components/MusteriSecici.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Users, Utensils, Shirt, Hotel, ShoppingCart, Wrench, Package } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  vkn: string;
  sector: string;
  phone: string;
  email: string;
  address: string;
  docCount: number;
  netAmount: number;
  vatRate: string;
  addedDate: string;
}

interface Props {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (c: Customer) => void;
  onAddNew: () => void;
  label?: string;
  placeholder?: string;
}

// Sektör ikonlarını döndüren fonksiyon
const getSectorIcon = (sector: string, size: number = 16) => {
  const icons: Record<string, React.ReactNode> = {
    Restoran: <Utensils size={size} style={{ color: '#f59e0b' }} />,
    Tekstil: <Shirt size={size} style={{ color: '#8b5cf6' }} />,
    Otel: <Hotel size={size} style={{ color: '#3b82f6' }} />,
    Market: <ShoppingCart size={size} style={{ color: '#10b981' }} />,
    Tamir: <Wrench size={size} style={{ color: '#ef4444' }} />,
    Diğer: <Package size={size} style={{ color: '#64748b' }} />,
  };
  return icons[sector] || icons['Diğer'];
};

const sectorColors: Record<string, string> = {
  Restoran: '#f59e0b',
  Tekstil: '#8b5cf6',
  Otel: '#3b82f6',
  Market: '#10b981',
  Tamir: '#ef4444',
  Diğer: '#64748b',
};

export default function MusteriSecici({
  customers,
  selected,
  onSelect,
  onAddNew,
  label = 'Müşteri Seç',
  placeholder = 'Müşteri seçin…',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-input-background text-sm text-foreground hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
      >
        <div className="flex items-center gap-2">
          {selected ? (
            <>
              {getSectorIcon(selected.sector, 16)}
              <span className="font-medium">{selected.name}</span>
              <span className="text-muted-foreground text-xs">({selected.sector})</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {customers.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <Users size={24} className="mx-auto mb-2 opacity-30" />
                Henüz müşteri yok
              </div>
            ) : (
              customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2">
                    {getSectorIcon(c.sector, 16)}
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-muted-foreground text-xs">· {c.sector}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{c.docCount} Belge</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => { setOpen(false); onAddNew(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/5"
              style={{ color: 'var(--primary)' }}
            >
              <Plus size={14} />
              Yeni Müşteri Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}