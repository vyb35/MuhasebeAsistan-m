// frontend/src/app/components/BeyannameWidget.tsx
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Loader2, AlertCircle, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

interface BeyannameWidgetProps {
  musteriId: number;
  musteriAdi: string;
}

export function BeyannameWidget({ musteriId, musteriAdi }: BeyannameWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ay, setAy] = useState(new Date().getMonth() + 1);
  const [yil, setYil] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);

  const fetchBeyanname = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/beyanname/hazirla/${musteriId}/${ay}/${yil}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'success') {
        setData(result.data);
      } else {
        setError(result.message || 'Veri alınamadı');
      }
    } catch (error: any) {
      console.error('Beyanname verisi çekilemedi:', error);
      setError(error.message || 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (musteriId) {
      fetchBeyanname();
    }
  }, [musteriId, ay, yil]);

  const handleExport = async () => {
    setGenerating(true);
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beyanname_${musteriAdi}_${ay}_${yil}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Beyanname verisi dışa aktarıldı.');
    } catch (error) {
      console.error('Dışa aktarma hatası:', error);
      alert('Dışa aktarma sırasında hata oluştu.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded w-full"></div>
          <div className="h-12 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <AlertCircle size={20} />
          <span className="font-semibold">Beyanname Verisi Alınamadı</span>
        </div>
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={fetchBeyanname} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
          Tekrar Dene →
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5 text-center py-8">
        <FileText size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-gray-400">Henüz beyanname verisi bulunmuyor.</p>
        <p className="text-sm text-gray-400 mt-1">Belge yükledikten sonra otomatik hesaplanacaktır.</p>
      </div>
    );
  }

  const netKdv = data.net_kdv || 0;

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">📑</span>
          <h3 className="font-semibold text-gray-800">e-Beyanname Hazırlık</h3>
          <span className="text-xs text-gray-400 ml-2 hidden sm:inline">{musteriAdi} · {data.donem}</span>
        </div>
        <button onClick={fetchBeyanname} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* İçerik */}
      <div className="p-5 space-y-4">
        {/* Dönem Seçici */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dönem:</label>
          <select value={ay} onChange={(e) => setAy(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border text-sm bg-white">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}. Ay</option>
            ))}
          </select>
          <select value={yil} onChange={(e) => setYil(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border text-sm bg-white">
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={fetchBeyanname} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            Getir
          </button>
        </div>

        {/* Dinamik KDV Listesi */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📊 KDV Matrah Dağılımı</p>
          
          {data.kdv_listesi && data.kdv_listesi.length > 0 ? (
            <div className="space-y-2">
              {data.kdv_listesi.map((item: any) => (
                <div key={item.oran} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                      %{item.oran}
                    </span>
                    <span className="text-gray-500">Matrah</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-gray-800">{fmt(item.matrah)}</span>
                    <span className="text-xs text-gray-400">KDV: {fmt(item.kdv_tutari)}</span>
                  </div>
                </div>
              ))}
              {data.otv_matrah > 0 && (
                <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">ÖTV</span>
                    <span className="text-gray-500">Matrah</span>
                  </div>
                  <span className="font-mono text-gray-800">{fmt(data.otv_matrah)}</span>
                </div>
              )}
              {data.istisna_matrah > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">İstisna</span>
                    <span className="text-gray-500">Matrah</span>
                  </div>
                  <span className="font-mono text-gray-800">{fmt(data.istisna_matrah)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Henüz KDV verisi bulunmuyor</p>
          )}
          
          <div className="mt-3 pt-3 border-t border-gray-300 flex items-center justify-between font-semibold text-sm">
            <span>TOPLAM MATRAH</span>
            <span className="font-mono text-lg">{fmt(data.toplam_matrah)}</span>
          </div>
        </div>

        {/* KDV Özeti */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
            <p className="text-xs text-green-600 font-semibold">Tahsil KDV</p>
            <p className="text-lg font-bold text-green-700 mt-1">{fmt(data.tahsil_kdv || 0)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
            <p className="text-xs text-red-600 font-semibold">Ödenen KDV</p>
            <p className="text-lg font-bold text-red-700 mt-1">{fmt(data.odenen_kdv || 0)}</p>
          </div>
          <div className={`rounded-lg p-3 text-center border ${netKdv > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-xs text-gray-600 font-semibold">Net KDV</p>
            <p className={`text-lg font-bold mt-1 ${netKdv > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{fmt(netKdv)}</p>
            <p className={`text-xs mt-0.5 ${netKdv > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {netKdv > 0 ? '🔴 Ödenecek' : '🟢 İade'}
            </p>
          </div>
        </div>

        {/* Kontrol Listesi */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">📋 Kontrol Listesi</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-green-500" />
              <span>{data.belge_sayisi} belge kaydedilmiş</span>
            </div>
            {data.eksikler && data.eksikler.length > 0 ? (
              <div className="flex items-start gap-2 text-sm text-yellow-700">
                <AlertTriangle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Eksikler: {data.eksikler.join(', ')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle size={16} className="text-green-500" />
                <span>Tüm belgeler tamam</span>
              </div>
            )}
            {data.hatalar && data.hatalar.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-red-700">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span>Hatalar: {data.hatalar.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dışa Aktar Butonu */}
        <button onClick={handleExport} disabled={generating} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {generating ? 'Dışa Aktarılıyor...' : '📄 Beyanname Verisini Dışa Aktar'}
        </button>
      </div>
    </div>
  );
}