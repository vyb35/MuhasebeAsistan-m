// src/app/pages/Musteriler.tsx
import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Users, Building2, Briefcase, ShoppingCart, Wrench, Package, Utensils, Shirt, Hotel } from 'lucide-react';
import { musterileriListele, musteriSil } from '../../services/api';
import { fmt } from '../App';

interface Musteri {
  id: number;
  adi: string;
  vergi_no: string;
  sektor: string;
  telefon: string;
  email: string;
  adres: string;
  belge_sayisi: number;
}

const sektorIkonlari: Record<string, { icon: any, color: string }> = {
  'Restoran': { icon: Utensils, color: '#f59e0b' },
  'Tekstil': { icon: Shirt, color: '#3b82f6' },
  'Otel': { icon: Hotel, color: '#8b5cf6' },
  'Market': { icon: ShoppingCart, color: '#10b981' },
  'Tamir': { icon: Wrench, color: '#ef4444' },
  'Diğer': { icon: Package, color: '#6b7280' },
};

export default function Musteriler({ 
  setPage, 
  notify, 
  onSelectMusteri 
}: { 
  setPage: (page: string) => void;
  notify: (msg: string) => void;
  onSelectMusteri: (musteri: Musteri) => void;
}) {
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sektorFilter, setSektorFilter] = useState('Tümü');
  const [sortBy, setSortBy] = useState('adi');

  useEffect(() => {
    loadMusteriler();
  }, []);

  const loadMusteriler = async () => {
    setLoading(true);
    try {
      const res = await musterileriListele();
      if (res.status === 'success') {
        setMusteriler(res.data || []);
      }
    } catch (error) {
      console.error('Müşteri listesi hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, adi: string) => {
    if (window.confirm(`"${adi}" müşterisini silmek istediğinize emin misiniz?`)) {
      try {
        await musteriSil(id);
        notify('Müşteri başarıyla silindi!');
        loadMusteriler();
      } catch (error) {
        notify('Silme sırasında hata oluştu!');
      }
    }
  };

  const filtered = musteriler.filter(m => {
    const matchSearch = m.adi.toLowerCase().includes(search.toLowerCase()) ||
                         (m.vergi_no || '').includes(search);
    const matchSektor = sektorFilter === 'Tümü' || m.sektor === sektorFilter;
    return matchSearch && matchSektor;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'adi') return a.adi.localeCompare(b.adi);
    if (sortBy === 'belge') return b.belge_sayisi - a.belge_sayisi;
    return 0;
  });

  const sektorler = ['Tümü', ...new Set(musteriler.map(m => m.sektor).filter(Boolean))];

  if (loading) {
    return (
      <div className="p-6 text-center flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Müşteriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">👥 Müşterilerim</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {musteriler.length} kayıtlı müşteri
          </p>
        </div>
        <button
          onClick={() => setPage('musteri-ekle')}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={18} />
          Yeni Müşteri Ekle
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <div className="relative">
          <select
            value={sektorFilter}
            onChange={(e) => setSektorFilter(e.target.value)}
            className="appearance-none px-4 py-2 pr-9 rounded-xl border border-border bg-card text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          >
            {sektorler.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">▼</span>
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none px-4 py-2 pr-9 rounded-xl border border-border bg-card text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          >
            <option value="adi">Ada Göre</option>
            <option value="belge">Belge Sayısına Göre</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">▼</span>
        </div>
      </div>

      {/* Müşteri Kartları */}
      {sorted.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <Users size={40} className="text-muted-foreground opacity-30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">📭 Henüz Müşteri Eklenmemiş</h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            İlk müşterinizi ekleyerek belge yönetimine başlayın.
          </p>
          <button
            onClick={() => setPage('musteri-ekle')}
            className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-sm inline-flex items-center gap-2"
          >
            <Plus size={16} />
            İlk Müşteriyi Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map((musteri) => {
            const sektorInfo = sektorIkonlari[musteri.sektor || 'Diğer'] || sektorIkonlari['Diğer'];
            const Icon = sektorInfo.icon;
            return (
              <div key={musteri.id} className="bg-card rounded-2xl border border-border shadow-xs hover:shadow-md transition-all overflow-hidden group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: sektorInfo.color + '15' }}>
                      <Icon size={24} style={{ color: sektorInfo.color }} />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                      {musteri.sektor || 'Diğer'}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-lg">{musteri.adi}</h3>
                  {musteri.vergi_no && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">VKN: {musteri.vergi_no}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Belge Sayısı</p>
                      <p className="text-lg font-bold text-foreground">{musteri.belge_sayisi || 0}</p>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={() => {
                          onSelectMusteri(musteri);
                          setPage('musteri-detay');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1"
                      >
                        <Eye size={12} />
                        Detay
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}