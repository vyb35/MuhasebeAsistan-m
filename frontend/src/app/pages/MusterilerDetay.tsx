// src/app/pages/MusteriDetay.tsx
import React from 'react';
import {
  ArrowLeft,
  FileCheck,
  DollarSign,
  Receipt,
  Building2,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  FileBarChart,
} from 'lucide-react';
import { fmt } from '../App';

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

interface Transaction {
  id: string;
  date: string;
  firm: string;
  amount: number;
  vat: number;
  type: "Fatura" | "Fiş" | "Z-Raporu";
  status: "Onaylandı" | "Beklemede" | "Hatalı";
}

interface Props {
  customer: Customer;
  onBack: () => void;
  transactions?: Transaction[];
}

const sectorIcons: Record<string, string> = {
  Restoran: '🍽️',
  Tekstil: '👕',
  Otel: '🏨',
  Market: '🛒',
  Tamir: '🔧',
  Diğer: '📦',
};

const sectorColors: Record<string, string> = {
  Restoran: '#f59e0b',
  Tekstil: '#8b5cf6',
  Otel: '#3b82f6',
  Market: '#10b981',
  Tamir: '#ef4444',
  Diğer: '#64748b',
};

const vatBadge: Record<string, { bg: string; text: string }> = {
  "%1": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "%10": { bg: "bg-blue-50", text: "text-blue-700" },
  "%20": { bg: "bg-amber-50", text: "text-amber-700" },
  "ÖTV": { bg: "bg-red-50", text: "text-red-700" },
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Onaylandı: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Beklemede: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  Hatalı: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

export default function MusteriDetay({ customer, onBack, transactions = [] }: Props) {
  const icon = sectorIcons[customer.sector] || '📦';
  const color = sectorColors[customer.sector] || '#64748b';
  const vb = vatBadge[customer.vatRate] || vatBadge["%20"];
  const gross = customer.netAmount * (1 + parseInt(customer.vatRate) / 100);
  const vatAmount = gross - customer.netAmount;

  // Müşteriye ait işlemleri filtrele (firma adına göre)
  const customerTransactions = transactions.filter(t => t.firm === customer.name);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Müşterilere Dön
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: color + '18' }}>
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{customer.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-mono">VKN: {customer.vkn}</span>
                <span>·</span>
                <span>{customer.sector}</span>
                <span>·</span>
                <span>{customer.docCount} Belge</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
              <FileBarChart size={14} />
              Rapor
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
              <Pencil size={14} />
              Düzenle
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
              Sil
            </button>
          </div>
        </div>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-3">
        {customer.phone && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground">
            <Phone size={13} />{customer.phone}
          </span>
        )}
        {customer.email && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground">
            <Mail size={13} />{customer.email}
          </span>
        )}
        {customer.address && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground">
            <MapPin size={13} />{customer.address}
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Toplam Belge", value: String(customer.docCount), icon: FileCheck, color: "#1a56db" },
          { label: "Net Tutar", value: fmt(customer.netAmount), icon: DollarSign, color: "#10b981" },
          { label: "KDV Tutarı", value: fmt(vatAmount), icon: Receipt, color: "#f59e0b" },
          { label: "Brüt Tutar", value: fmt(gross), icon: Building2, color: "#8b5cf6" },
        ].map(({ label, value, icon: I, color: c }) => (
          <div key={label} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c + '18' }}>
                <I size={14} style={{ color: c }} />
              </div>
            </div>
            <p className="text-lg font-bold text-foreground font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* KDV Matrah + Info */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* KDV Matrah (Mock - gerçek verilerle değişecek) */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">KDV Matrah Dağılımı</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                {["KDV Oranı", "Matrah", "KDV Tutarı"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["%1", 2000, 20],
                ["%10", 6500, 650],
                ["%20", 4000, 800],
              ].map(([rate, matrah, kdv]) => (
                <tr key={String(rate)} className="border-b border-border/50">
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${vatBadge[rate as keyof typeof vatBadge]?.bg || "bg-muted"} ${vatBadge[rate as keyof typeof vatBadge]?.text || "text-muted-foreground"}`}>{rate}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-sm text-foreground">{fmt(matrah as number)}</td>
                  <td className="px-5 py-3 font-mono text-sm text-foreground">{fmt(kdv as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Customer info */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">Müşteri Bilgileri</h3>
          <div className="space-y-3">
            {[
              ["Müşteri ID", customer.id],
              ["Eklenme Tarihi", customer.addedDate],
              ["Sektör", customer.sector],
              ["Varsayılan KDV", customer.vatRate],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent docs table */}
      {customerTransactions.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Son Belgeler</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {["Tarih", "Belge Türü", "Firma", "Tutar", "KDV", "Durum"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customerTransactions.slice(0, 5).map((t) => {
                  const s = statusConfig[t.status] || statusConfig.Onaylandı;
                  return (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{t.date}</td>
                      <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground font-medium">{t.type}</span></td>
                      <td className="px-5 py-3.5 font-medium text-foreground">{t.firm}</td>
                      <td className="px-5 py-3.5 font-mono text-sm font-medium text-foreground">{fmt(t.amount)}</td>
                      <td className="px-5 py-3.5 font-mono text-sm text-muted-foreground">{fmt(t.vat)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}