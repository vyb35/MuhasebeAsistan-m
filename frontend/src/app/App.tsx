// src/app/App.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  FileText,
  Bell,
  ChevronDown,
  Search,
  Download,
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown,
  FileCheck,
  DollarSign,
  Receipt,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  Settings,
  Calculator,
  Users,
  Plus,
  X,
  Utensils,
  ShoppingCart,
  Wrench,
  Package,
  Hotel,
  Shirt,
  Pencil,
  ArrowLeft,
  FileBarChart,
  Phone,
  Mail,
  MapPin,
  Building2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { belgeYukle, belgeleriListele, musterileriListele, belgeSil, musteriEkle } from "../services/api";
import { KDVWidget } from "./components/KDVWidget";
import { BankaMutabakat } from "./components/BankaMutabakat";
import { BeyannameWidget } from "./components/BeyannameWidget";

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = "dashboard" | "reports" | "documents" | "customers";

interface Transaction {
  id: string;
  date: string;
  firm: string;
  amount: number;
  vat: number;
  type: "Fatura" | "Fiş" | "Z-Raporu";
  status: "Onaylandı" | "Beklemede" | "Hatalı";
  items?: Array<{ kdv_orani?: number; tutar?: number; urun_adi?: string; }>;
  musteri_id?: number;
}

interface Customer {
  id: number;
  name: string;
  vkn: string;
  sector: string;
  phone: string;
  email: string;
  address: string;
  docCount: number;
  netAmount: number;
  kdvAmount: number;
  brutAmount: number;
  vatRate: string;
  addedDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

const statusConfig: Record<Transaction["status"], { bg: string; text: string; dot: string }> = {
  Onaylandı: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Beklemede: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  Hatalı: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const sectorColors: Record<string, string> = {
  Restoran: "#f59e0b",
  Tekstil: "#8b5cf6",
  Otel: "#3b82f6",
  Market: "#10b981",
  Tamir: "#ef4444",
  Diğer: "#64748b",
};

const SECTORS = ["Restoran", "Tekstil", "Otel", "Market", "Tamir", "Diğer"];

// ─── Gerçek Verilerle Grafik Hesaplama ──────────────────────────────────────

const calculateRevenueData = (transactions: Transaction[]) => {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const monthlyData = months.map((ay) => ({ ay, gelir: 0, gider: 0 }));

  transactions.forEach((t) => {
    const dateParts = t.date.split(".");
    if (dateParts.length === 3) {
      const month = parseInt(dateParts[1]) - 1;
      const year = parseInt(dateParts[2]);
      const currentYear = new Date().getFullYear();
      if (year === currentYear && month >= 0 && month < 12) {
        if (t.type === "Fatura" || t.type === "Fiş") {
          monthlyData[month].gelir += t.amount;
        } else if (t.type === "Z-Raporu") {
          monthlyData[month].gider += t.amount;
        }
      }
    }
  });

  return monthlyData;
};

const calculateVatData = (transactions: Transaction[]) => {
  const vatDistribution: Record<string, number> = {
    "%20 KDV": 0,
    "%10 KDV": 0,
    "%1 KDV": 0,
    "İstisna": 0,
  };

  transactions.forEach((t) => {
    if (t.items && t.items.length > 0) {
      t.items.forEach((item: any) => {
        const oran = item.kdv_orani || 20;
        const tutar = item.tutar || 0;
        if (oran === 1) vatDistribution["%1 KDV"] += tutar;
        else if (oran === 10) vatDistribution["%10 KDV"] += tutar;
        else if (oran === 20) vatDistribution["%20 KDV"] += tutar;
        else vatDistribution["İstisna"] += tutar;
      });
    } else {
      const oran = t.vat > 0 ? Math.round((t.vat / t.amount) * 100) : 20;
      const key = `%${oran} KDV`;
      if (vatDistribution.hasOwnProperty(key)) {
        vatDistribution[key] += t.amount;
      } else {
        vatDistribution["%20 KDV"] += t.amount;
      }
    }
  });

  const colors: Record<string, string> = {
    "%20 KDV": "#1a56db",
    "%10 KDV": "#3b82f6",
    "%1 KDV": "#93c5fd",
    "İstisna": "#dbeafe",
  };

  return Object.entries(vatDistribution)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value, color: colors[name] || "#64748b" }));
};

// ─── Customer Selector ────────────────────────────────────────────────────────

function CustomerSelector({ customers, selected, onSelect, onAddNew }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getIcon = (sector: string) => {
    const icons: any = { Restoran: "🍽️", Tekstil: "👕", Otel: "🏨", Market: "🛒", Tamir: "🔧", Diğer: "📦" };
    return icons[sector] || "📦";
  };

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Müşteri Seç</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-white text-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <div className="flex items-center gap-2">
          {selected ? (
            <>
              <span className="text-base">{getIcon(selected.sector)}</span>
              <span className="font-medium">{selected.name}</span>
              <span className="text-gray-500 text-xs">({selected.sector})</span>
            </>
          ) : (
            <span className="text-gray-500">Müşteri seçin…</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {customers.map((c: Customer) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); setOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{getIcon(c.sector)}</span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-500 text-xs">· {c.sector}</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">{c.docCount} Belge</span>
              </button>
            ))}
          </div>
          <div className="border-t">
            <button
              onClick={() => { setOpen(false); onAddNew(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              <Plus size={14} /> Yeni Müşteri Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────

function AddCustomerModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: "",
    vkn: "",
    sector: "Restoran",
    phone: "",
    email: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    console.log("🎯 handleSave çalıştı! form.name:", form.name);
    if (!form.name.trim()) {
      alert("Müşteri adı boş olamaz!");
      return;
    }

    const newCustomer = {
      adi: form.name.trim(),
      vergi_no: form.vkn || null,
      sektor: form.sector || null,
      telefon: form.phone || null,
      email: form.email || null,
      adres: form.address || null,
    };

    console.log("📤 Gönderilecek müşteri:", newCustomer);
    onSave(newCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Plus size={16} color="white" />
            </div>
            <h2 className="font-semibold">Yeni Müşteri Ekle</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Müşteri Adı *</label>
            <input
              type="text"
              name="name"
              placeholder="Kafe XYZ"
              value={form.name}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Vergi No</label>
              <input
                type="text"
                name="vkn"
                placeholder="1234567890"
                value={form.vkn}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Sektör *</label>
              <select
                name="sector"
                value={form.sector}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Telefon</label>
              <input
                type="tel"
                name="phone"
                placeholder="0212 555 00 00"
                value={form.phone}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">E-posta</label>
              <input
                type="email"
                name="email"
                placeholder="info@firma.com"
                value={form.email}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Adres</label>
            <input
              type="text"
              name="address"
              placeholder="İlçe, Şehir"
              value={form.address}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50">
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle size={15} /> Müşteriyi Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, collapsed, setCollapsed }: any) {
  const navItems = [
    { id: "dashboard", label: "Ana Sayfa", icon: LayoutDashboard },
    { id: "documents", label: "Belge Listesi", icon: FileText },
    { id: "customers", label: "Müşteriler", icon: Users },
  ];

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-300 z-20 ${collapsed ? "w-16" : "w-60"}`}
      style={{ background: "#0f172a" }}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1a56db" }}>
          <Calculator size={16} color="white" />
        </div>
        {!collapsed && <span className="font-semibold text-white text-base tracking-tight">MuhasebeAI</span>}
        <button className="ml-auto text-slate-400 hover:text-white" onClick={() => setCollapsed(!collapsed)}>
          <Menu size={16} />
        </button>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${active ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
              style={active ? { background: "#1a56db" } : {}}
            >
              <Icon size={17} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="px-2 py-4 border-t border-white/10 space-y-0.5">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm">
          <Settings size={17} /> {!collapsed && <span>Ayarlar</span>}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm">
          <LogOut size={17} /> {!collapsed && <span>Çıkış Yap</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ title, action }: any) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        {action}
        <button className="relative p-2 rounded-lg hover:bg-gray-100">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: "#1a56db" }}>
            AY
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none">Ahmet Yılmaz</p>
            <p className="text-xs text-gray-500 mt-0.5">Yönetici</p>
          </div>
          <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage({ setPage, customers }: {
  setPage: (p: Page) => void;
  customers: Customer[];
}) {
  const getSectorIcon = (sector: string) => {
    const icons: Record<string, string> = {
      Restoran: "🍽️",
      Tekstil: "👕",
      Otel: "🏨",
      Market: "🛒",
      Tamir: "🔧",
      Diğer: "📦",
    };
    return icons[sector] || "📦";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">👥 Müşterilerim</h2>
          <button
            onClick={() => setPage("customers")}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            Tümünü Gör →
          </button>
        </div>

        {customers.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
            <p className="text-gray-500">Henüz müşteri eklenmemiş.</p>
            <button
              onClick={() => setPage("customers")}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Müşteri eklemek için tıklayın
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => {
                  localStorage.setItem('selectedCustomerId', String(customer.id));
                  setPage("customers");
                }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer p-5 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {getSectorIcon(customer.sector)}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                        {customer.name}
                      </h3>
                      <p className="text-xs text-gray-500">{customer.sector}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                    {customer.docCount} Belge
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Net Tutar</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {fmt(customer.netAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">KDV</span>
                    <span className="font-mono text-sm text-gray-700">
                      {fmt(customer.kdvAmount || 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <span className="text-xs text-blue-600 font-medium group-hover:underline">
                    Detayları Gör →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports Page ────────────────────────────────────────────────────────────

function ReportsPage({
  transactions,
  selectedCustomer,
  onBack,
}: any) {

  if (!selectedCustomer) {
    return null;
  }

  const customerTransactions = transactions.filter((t: Transaction) => {
    if (t.musteri_id) {
      return t.musteri_id === selectedCustomer.id;
    }
    return t.firm === selectedCustomer.name;
  });

  const totalNet = customerTransactions.reduce((acc: number, t: Transaction) => acc + t.amount, 0);
  const totalVat = customerTransactions.reduce((acc: number, t: Transaction) => acc + t.vat, 0);
  const totalBrut = totalNet + totalVat;

  const revenueData = calculateRevenueData(customerTransactions);
  const vatData = calculateVatData(customerTransactions);

  const getSectorIcon = (sector: string) => {
    const icons: Record<string, string> = {
      Restoran: "🍽️",
      Tekstil: "👕",
      Otel: "🏨",
      Market: "🛒",
      Tamir: "🔧",
      Diğer: "📦",
    };
    return icons[sector] || "📦";
  };

  return (
    <div className="p-6 space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
      >
        <ArrowLeft size={15} />
        {selectedCustomer.name} - Detayına Dön
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ background: "#f59e0b18" }}>
          {getSectorIcon(selectedCustomer.sector)}
        </div>
        <div>
          <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
          <p className="text-sm text-gray-500">{selectedCustomer.sector} · {selectedCustomer.docCount} belge</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Toplam Net</p>
          <p className="text-2xl font-bold mt-1">{fmt(totalNet)}</p>
          <p className="text-xs text-gray-400 mt-1">{customerTransactions.length} belge</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Toplam KDV</p>
          <p className="text-2xl font-bold mt-1">{fmt(totalVat)}</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Toplam Brüt</p>
          <p className="text-2xl font-bold mt-1">{fmt(totalBrut)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-sm mb-4">📊 Aylık Gelir / Gider</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="ay" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [fmt(v), ""]} contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, background: "white" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gelir" name="Gelir" fill="#1a56db" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gider" name="Gider" fill="#93c5fd" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-sm mb-4">KDV Dağılımı</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={vatData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                {vatData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [fmt(v), ""]} contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, background: "white" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3 border-t pt-3">
            {vatData.map((d: any) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-gray-600 font-medium">{d.name}</span>
                </div>
                <span className="font-mono font-semibold text-gray-900">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Page ───────────────────────────────────────────────────────────

function DocumentsPage({ transactions, onDelete }: { transactions: Transaction[]; onDelete: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    return (
      (!q || t.firm.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) &&
      (typeFilter === "Tümü" || t.type === typeFilter) &&
      (statusFilter === "Tümü" || t.status === statusFilter)
    );
  });

  const pageSize = 5;
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const confirmDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Firma adı veya belge ID ara…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        {["Tümü", "Fatura", "Fiş", "Z-Raporu"].map((t) => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${typeFilter === t ? "border-blue-600 bg-blue-600 text-white" : "border bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {t}
          </button>
        ))}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 pr-8 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          {["Tümü", "Onaylandı", "Beklemede", "Hatalı"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Belgeler</h2>
          <span className="text-xs text-gray-500">{filtered.length} sonuç</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Belge ID", "Tarih", "Firma", "Tür", "Tutar", "KDV", "Durum", "İşlemler"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-500">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
                    Sonuç bulunamadı
                  </td>
                </tr>
              ) : (
                paged.map((t) => {
                  const s = statusConfig[t.status as keyof typeof statusConfig];
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-blue-600">{t.id}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{t.date}</td>
                      <td className="px-5 py-3.5 font-medium">{t.firm}</td>
                      <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded text-xs bg-gray-100 font-medium">{t.type}</span></td>
                      <td className="px-5 py-3.5 font-mono text-sm font-medium">{fmt(t.amount)}</td>
                      <td className="px-5 py-3.5 font-mono text-sm text-gray-500">{fmt(t.vat)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s?.bg || "bg-gray-100"} ${s?.text || "text-gray-700"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s?.dot || "bg-gray-400"}`} />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t flex items-center justify-between">
            <p className="text-xs text-gray-500">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium ${p === page ? "text-white bg-blue-600" : "border hover:bg-gray-50"}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
          <div className="bg-white rounded-2xl shadow-2xl border p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="font-semibold">Belgeyi Sil</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium text-gray-900">{deleteId}</span> numaralı belge kalıcı olarak silinecek.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50">
                Vazgeç
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customers Page ───────────────────────────────────────────────────────────

function CustomersPage({
  customers,
  onAddNew,
  onAddCustomer,
  showModal,
  onCloseModal,
  onRefresh,
  transactions,
  onUpload,
  setSelectedCustomerForReport,
  setPage,
  selectedCustomer,
}: any) {
  console.log("📌 CustomersPage render - showModal:", showModal);
  console.log("📌 CustomersPage render - customers:", customers?.length);

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Tümü");
  const [sortBy, setSortBy] = useState("Ada Göre");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const selectedCustomerId = localStorage.getItem("selectedCustomerId");

  useEffect(() => {
    if (selectedCustomerId && customers.length > 0) {
      const found = customers.find((c: Customer) => String(c.id) === selectedCustomerId);
      if (found) {
        setSelectedCustomerForReport(found);
        localStorage.removeItem("selectedCustomerId");
      }
    }
  }, [customers, selectedCustomerId, setSelectedCustomerForReport]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomer) return;

    setUploading(true);
    setUploadStatus({ type: null, message: "" });
    try {
      await onUpload(file, selectedCustomer.id, "fatura");
      setUploadStatus({ type: "success", message: "Belge başarıyla yüklendi." });
      setTimeout(() => setUploadStatus({ type: null, message: "" }), 3000);
    } catch (error: any) {
      console.error("Yükleme hatası:", error);
      setUploadStatus({
        type: "error",
        message: error?.response?.data?.detail || "Belge yüklenirken bir hata oluştu.",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (selectedCustomer) {
    const net = selectedCustomer.netAmount || 0;
    const kdv = selectedCustomer.kdvAmount || 0;
    const brut = net + kdv;

    const customerTransactions = transactions.filter((t: Transaction) => {
      if (t.musteri_id) {
        return t.musteri_id === selectedCustomer.id;
      }
      return t.firm === selectedCustomer.name;
    });

    let kdv1Total = 0;
    let kdv10Total = 0;
    let kdv20Total = 0;

    customerTransactions.forEach((t: Transaction) => {
      if (t.items && t.items.length > 0) {
        t.items.forEach((item: any) => {
          const oran = item.kdv_orani || 20;
          const tutar = item.tutar || 0;
          if (oran === 1) kdv1Total += tutar;
          else if (oran === 10) kdv10Total += tutar;
          else kdv20Total += tutar;
        });
      } else {
        const oran = t.vat > 0 ? Math.round((t.vat / t.amount) * 100) : 20;
        if (oran === 1) kdv1Total += t.amount;
        else if (oran === 10) kdv10Total += t.amount;
        else kdv20Total += t.amount;
      }
    });

    const kdvMatrahData = [
      { rate: "%1", matrah: kdv1Total, kdv: kdv1Total * 0.01 },
      { rate: "%10", matrah: kdv10Total, kdv: kdv10Total * 0.10 },
      { rate: "%20", matrah: kdv20Total, kdv: kdv20Total * 0.20 },
    ];

    const filteredKdvData = kdvMatrahData.filter((d) => d.matrah > 0);

    const getSectorIcon = (sector: string) => {
      const icons: Record<string, string> = {
        Restoran: "🍽️",
        Tekstil: "👕",
        Otel: "🏨",
        Market: "🛒",
        Tamir: "🔧",
        Diğer: "📦",
      };
      return icons[sector] || "📦";
    };

    return (
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <button
          onClick={() => {
            setSelectedCustomerForReport(null);
          }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Müşterilere Dön
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "#f59e0b18" }}>
              {getSectorIcon(selectedCustomer.sector)}
            </div>
            <div>
              <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-mono">VKN: {selectedCustomer.vkn}</span>
                <span>·</span>
                <span>{selectedCustomer.sector}</span>
                <span>·</span>
                <span>{selectedCustomer.docCount} Belge</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif,.zip,.rar,.7z"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <button
                onClick={() => document.getElementById("file-upload-input")?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Belge Yükle
                  </>
                )}
              </button>
            </div>
            <button
              onClick={() => {
                setSelectedCustomerForReport(selectedCustomer);
                setPage("reports");
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
            >
              <FileBarChart size={14} /> Rapor
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Sil
            </button>
          </div>
        </div>

        {uploadStatus.type && (
          <div
            className={`p-3 rounded-lg text-sm ${
              uploadStatus.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {uploadStatus.message}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {selectedCustomer.phone && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm text-gray-500">
              <Phone size={13} />
              {selectedCustomer.phone}
            </span>
          )}
          {selectedCustomer.email && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm text-gray-500">
              <Mail size={13} />
              {selectedCustomer.email}
            </span>
          )}
          {selectedCustomer.address && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm text-gray-500">
              <MapPin size={13} />
              {selectedCustomer.address}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Toplam Belge", value: String(selectedCustomer.docCount), icon: FileCheck, color: "#1a56db" },
            { label: "Net Tutar", value: fmt(net), icon: DollarSign, color: "#10b981" },
            { label: "KDV Tutarı", value: fmt(kdv), icon: Receipt, color: "#f59e0b" },
            { label: "Brüt Tutar", value: fmt(brut), icon: Building2, color: "#8b5cf6" },
          ].map(({ label, value, icon: I, color: c }) => (
            <div key={label} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c + "18" }}>
                  <I size={14} style={{ color: c }} />
                </div>
              </div>
              <p className="text-lg font-bold font-mono">{value}</p>
            </div>
          ))}
        </div>

        {/* KDV DURUMU WIDGET'İ */}
        <KDVWidget 
          musteriId={selectedCustomer.id} 
          musteriAdi={selectedCustomer.name}
          musteriSektor={selectedCustomer.sector}
        />

        {/* BANKA MUTABAKATI WIDGET'İ */}
        <BankaMutabakat 
          musteriId={selectedCustomer.id} 
          musteriAdi={selectedCustomer.name}
        />

        {/* e-BEYANNAME WIDGET'İ */}
        <BeyannameWidget 
          musteriId={selectedCustomer.id} 
          musteriAdi={selectedCustomer.name}
        />

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">KDV Matrah Dağılımı</h3>
            <span className="text-xs text-gray-400">
              {filteredKdvData.length > 0 ? `${filteredKdvData.length} oran` : "Henüz belge yok"}
            </span>
          </div>

          {filteredKdvData.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
              Bu müşteriye ait henüz belge bulunmuyor.
              <br />
              <span className="text-xs">Belge yükledikten sonra KDV matrahı otomatik hesaplanacaktır.</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  {["KDV Oranı", "Matrah", "KDV Tutarı"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredKdvData.map(({ rate, matrah, kdv: kdvTutar }) => (
                  <tr key={rate} className="border-b hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                        {rate}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm">{fmt(matrah)}</td>
                    <td className="px-5 py-3 font-mono text-sm">{fmt(kdvTutar)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 border-t border-blue-200">
                  <td className="px-5 py-3 font-semibold text-sm text-blue-700">TOPLAM</td>
                  <td className="px-5 py-3 font-mono text-sm font-bold text-blue-700">
                    {fmt(filteredKdvData.reduce((acc, d) => acc + d.matrah, 0))}
                  </td>
                  <td className="px-5 py-3 font-mono text-sm font-bold text-blue-700">
                    {fmt(filteredKdvData.reduce((acc, d) => acc + d.kdv, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">📄 Müşteri Belgeleri</h3>
            <span className="text-xs text-gray-400">{customerTransactions.length} belge</span>
          </div>

          {customerTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <FileText size={32} className="mx-auto mb-2 opacity-40" />
              Bu müşteriye ait henüz belge bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {["Tarih", "Belge Türü", "Firma", "Net Tutar", "KDV", "Brüt Tutar"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerTransactions.map((t: Transaction) => (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.date}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 font-medium">{t.type}</span>
                      </td>
                      <td className="px-5 py-3 font-medium">{t.firm}</td>
                      <td className="px-5 py-3 font-mono text-sm">{fmt(t.amount)}</td>
                      <td className="px-5 py-3 font-mono text-sm text-gray-500">{fmt(t.vat)}</td>
                      <td className="px-5 py-3 font-mono text-sm font-medium">{fmt(t.amount + t.vat)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t border-gray-300">
                    <td className="px-5 py-3 font-semibold text-sm">TOPLAM</td>
                    <td className="px-5 py-3"></td>
                    <td className="px-5 py-3"></td>
                    <td className="px-5 py-3 font-mono text-sm font-bold">
                      {fmt(customerTransactions.reduce((acc: number, t: Transaction) => acc + t.amount, 0))}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-bold">
                      {fmt(customerTransactions.reduce((acc: number, t: Transaction) => acc + t.vat, 0))}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-bold">
                      {fmt(customerTransactions.reduce((acc: number, t: Transaction) => acc + t.amount + t.vat, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filtered = customers
    .filter((c: Customer) => {
      const q = search.toLowerCase();
      return (
        (!q || c.name.toLowerCase().includes(q) || c.vkn.includes(q)) &&
        (sectorFilter === "Tümü" || c.sector === sectorFilter)
      );
    })
    .sort((a: Customer, b: Customer) => {
      if (sortBy === "Ada Göre") return a.name.localeCompare(b.name, "tr");
      if (sortBy === "Belge Sayısına Göre") return b.docCount - a.docCount;
      return 0;
    });

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Müşteri ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="px-3 py-2.5 pr-8 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option>Tümü</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2.5 pr-8 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option>Ada Göre</option>
          <option>Belge Sayısına Göre</option>
        </select>
        <button
          onClick={() => {
            console.log("🖱️ Yeni Müşteri Ekle butonuna tıklandı (CustomersPage içinden)!");
            onAddNew();
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors ml-auto"
        >
          <Plus size={15} /> Yeni Müşteri Ekle
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} /> Yenile
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <Users size={32} className="text-gray-400 opacity-40" />
          </div>
          <p className="font-semibold">Henüz Müşteri Eklenmemiş</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">
            İlk müşterinizi ekleyerek belge yönetimine başlayın.
          </p>
          <button
            onClick={() => {
              console.log("🖱️ İlk Müşteriyi Ekle butonuna tıklandı!");
              onAddNew();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={15} /> İlk Müşteriyi Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: Customer) => (
            <div
              key={c.id}
              onClick={() => {
                setSelectedCustomerForReport(c);
              }}
              className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: (sectorColors[c.sector] || "#64748b") + "18" }}
                  >
                    {c.sector === "Restoran" && "🍽️"}
                    {c.sector === "Tekstil" && "👕"}
                    {c.sector === "Otel" && "🏨"}
                    {c.sector === "Market" && "🛒"}
                    {c.sector === "Tamir" && "🔧"}
                    {!c.sector && "📦"}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.sector}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                  {c.docCount} Belge
                </span>
              </div>
              <div className="space-y-2 mb-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 text-xs">VKN</span>
                  <span className="font-mono text-xs">{c.vkn}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-500 text-xs">Net Tutar</span>
                  <span className="font-mono text-sm font-semibold">{fmt(c.netAmount)}</span>
                </div>
              </div>
              <div className="mt-3 text-center border-t pt-3">
                <span className="text-xs text-blue-600 font-medium group-hover:underline">
                  Detayları Gör →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddCustomerModal
          onClose={() => {
            console.log("❌ Modal kapatılıyor");
            onCloseModal();
          }}
          onSave={(c: Customer) => {
            console.log("📤 onSave çağrıldı! Müşteri:", c);
            onAddCustomer(c);
            onCloseModal();
          }}
        />
      )}
    </div>
  );
}

// ─── Page titles ──────────────────────────────────────────────────────────────

const pageTitles: Record<Page, string> = {
  dashboard: "Ana Sayfa",
  reports: "Raporlar",
  documents: "Belge Listesi",
  customers: "Müşterilerim",
};

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const musteriRes = await musterileriListele();
      if (musteriRes.status === "success") {
        const formattedCustomers = musteriRes.data.map((m: any) => ({
          id: Number(m.id),
          name: m.adi,
          vkn: m.vergi_no || "—",
          sector: m.sektor || "Diğer",
          phone: m.telefon || "",
          email: m.email || "",
          address: m.adres || "",
          docCount: m.belge_sayisi || 0,
          netAmount: m.toplam_net || 0,
          kdvAmount: m.toplam_kdv || 0,
          brutAmount: m.toplam_brut || 0,
          vatRate: "%20",
          addedDate: m.created_at ? new Date(m.created_at).toLocaleDateString("tr-TR") : "-",
        }));
        setCustomers(formattedCustomers);
      }

      const belgeRes = await belgeleriListele();
      if (belgeRes.status === "success") {
        const formattedDocs = belgeRes.data.map((d: any) => ({
          id: String(d.id),
          date: d.tarih || new Date().toLocaleDateString("tr-TR"),
          firm: d.firma_adi || "—",
          amount: d.toplam_net || 0,
          vat: d.toplam_kdv || 0,
          type: d.belge_turu === "fatura" ? "Fatura" : d.belge_turu === "fis" ? "Fiş" : "Z-Raporu",
          status: "Onaylandı",
          musteri_id: d.musteri_id || null,
        }));
        setTransactions(formattedDocs);
      }
    } catch (error) {
      console.error("Veri yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (file: File, musteriId: number, belgeTuru: string) => {
    await belgeYukle(file, musteriId, belgeTuru);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await belgeSil(Number(id));
    await loadData();
  };

  const addCustomer = async (customerData: any) => {
    try {
      console.log("Müşteri ekleniyor...", customerData);
      const result = await musteriEkle(customerData);
      console.log("Müşteri eklendi:", result);
      await loadData();
      setShowAddCustomerModal(false);
    } catch (error: any) {
      console.error("Müşteri ekleme hatası:", error);
      console.error("Hata detayı:", error.response?.data);
      alert(`Müşteri eklenirken hata oluştu: ${error.response?.data?.detail || error.message}`);
    }
  };

  const topbarAction =
    page === "customers" ? (
      <button
        onClick={() => {
          console.log("🖱️ Topbar - Yeni Müşteri Ekle butonuna tıklandı!");
          setShowAddCustomerModal(true);
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
      >
        <Plus size={15} /> Yeni Müşteri Ekle
      </button>
    ) : undefined;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={pageTitles[page]} action={topbarAction} />
        <main className="flex-1 overflow-y-auto">
          {page === "dashboard" && <DashboardPage setPage={setPage} customers={customers} />}
          {page === "reports" && (
            <ReportsPage
              transactions={transactions}
              selectedCustomer={selectedCustomer}
              onBack={() => {
                setPage("customers");
              }}
            />
          )}
          {page === "documents" && <DocumentsPage transactions={transactions} onDelete={handleDelete} />}
          {page === "customers" && (
            <CustomersPage
              customers={customers}
              onAddNew={() => {
                console.log("📌 onAddNew çağrıldı! showAddCustomerModal true yapılıyor");
                setShowAddCustomerModal(true);
              }}
              onAddCustomer={addCustomer}
              showModal={showAddCustomerModal}
              onCloseModal={() => {
                console.log("📌 onCloseModal çağrıldı! showAddCustomerModal false yapılıyor");
                setShowAddCustomerModal(false);
              }}
              onRefresh={loadData}
              transactions={transactions}
              onUpload={handleUpload}
              setSelectedCustomerForReport={setSelectedCustomer}
              setPage={setPage}
              selectedCustomer={selectedCustomer}
            />
          )}
        </main>
      </div>
    </div>
  );
}