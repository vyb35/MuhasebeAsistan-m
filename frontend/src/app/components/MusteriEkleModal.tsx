// src/app/components/MusteriEkleModal.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { musteriEkle } from '../../services/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  notify: (msg: string) => void;
}

export default function MusteriEkleModal({ onClose, onSuccess, notify }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    adi: '',
    vergi_no: '',
    sektor: 'Restoran',
    telefon: '',
    email: '',
    adres: '',
  });

  const sektorler = ['Restoran', 'Tekstil', 'Otel', 'Market', 'Tamir / Servis', 'Diğer'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.adi.trim()) {
      notify('Müşteri adı zorunludur!');
      return;
    }

    setLoading(true);
    try {
      await musteriEkle(form);
      notify('Müşteri başarıyla eklendi!');
      onSuccess();
      onClose();
    } catch (error) {
      notify('Müşteri eklenirken hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl border border-border p-6 w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
          <h3 className="font-bold text-foreground text-lg">➕ Yeni Müşteri Ekle</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Müşteri Adı *
            </label>
            <input
              type="text"
              value={form.adi}
              onChange={(e) => setForm({ ...form, adi: e.target.value })}
              placeholder="Kafe XYZ"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Vergi No (VKN)
              </label>
              <input
                type="text"
                value={form.vergi_no}
                onChange={(e) => setForm({ ...form, vergi_no: e.target.value })}
                placeholder="1234567890"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Sektör *
              </label>
              <select
                value={form.sektor}
                onChange={(e) => setForm({ ...form, sektor: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                {sektorler.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Telefon
              </label>
              <input
                type="text"
                value={form.telefon}
                onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                placeholder="0555 123 45 67"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                E-posta
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="info@kafexyz.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Adres
            </label>
            <textarea
              value={form.adres}
              onChange={(e) => setForm({ ...form, adres: e.target.value })}
              placeholder="Atatürk Cad. No:12 İstanbul"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:opacity-90 transition-all shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {loading ? 'Kaydediliyor...' : '💾 Müşteriyi Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}