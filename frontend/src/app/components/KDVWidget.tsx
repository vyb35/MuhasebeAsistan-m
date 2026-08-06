// frontend/src/app/components/KDVWidget.tsx
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Loader2, AlertCircle } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

interface KDVWidgetProps {
  musteriId: number;
  musteriAdi: string;
  musteriSektor?: string;
}

interface KDVData {
  musteri_id: number;
  donem: string;
  tahsil_kdv: number;
  odenen_kdv: number;
  net_kdv: number;
  kdv1_matrahi: number;
  kdv10_matrahi: number;
  kdv20_matrahi: number;
  durum: string;
  guncelleme_tarihi: string;
}

export function KDVWidget({ musteriId, musteriAdi, musteriSektor }: KDVWidgetProps) {
  const [kdvData, setKdvData] = useState<KDVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://127.0.0.1:8000';

  const fetchKDV = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/kdv/durum/${musteriId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setKdvData(data.data);
      } else {
        setError(data.message || 'Veri alınamadı');
      }
    } catch (error: any) {
      console.error('KDV verisi çekilemedi:', error);
      setError(error.message || 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (musteriId) {
      fetchKDV();
    }
  }, [musteriId]);

  const handleRaporOlustur = async () => {
    setGenerating(true);
    try {
      const ay = new Date().getMonth() + 1;
      const yil = new Date().getFullYear();
      
      const response = await fetch(`${API_BASE}/api/kdv/rapor/${musteriId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ay, yil })
      });
      
      if (!response.ok) {
        throw new Error('Rapor oluşturulamadı');
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        alert(`KDV Raporu başarıyla oluşturuldu.\n\nMüşteri: ${musteriAdi}\nDönem: ${result.data.donem}\nNet KDV: ${fmt(result.data.net_kdv)}`);
      } else {
        throw new Error(result.message || 'Bilinmeyen hata');
      }
    } catch (error: any) {
      console.error('Rapor oluşturulamadı:', error);
      alert(`Rapor oluşturulurken hata: ${error.message}`);
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
          <span className="font-semibold">KDV Verisi Alınamadı</span>
        </div>
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={fetchKDV}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Tekrar Dene →
        </button>
      </div>
    );
  }

  if (!kdvData) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5 text-center py-8">
        <p className="text-gray-400">Henüz KDV verisi bulunmuyor.</p>
        <p className="text-sm text-gray-400 mt-1">Belge yükledikten sonra otomatik hesaplanacaktır.</p>
      </div>
    );
  }

  const netKdv = kdvData.net_kdv || 0;
  const durum = kdvData.durum || 'NOTR';

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧾</span>
          <h3 className="font-semibold text-gray-800">KDV Durumu</h3>
          <span className="text-xs text-gray-400 ml-2 hidden sm:inline">
            {musteriAdi} · {kdvData.donem}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">
            {new Date(kdvData.guncelleme_tarihi).toLocaleString('tr-TR')}
          </span>
          <button
            onClick={fetchKDV}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            title="Yenile"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Tahsil Edilen KDV</p>
            <p className="text-xl font-bold text-green-700 mt-1">
              {fmt(kdvData.tahsil_kdv || 0)}
            </p>
            <p className="text-xs text-green-500 mt-0.5">Satışlardan</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Ödenen KDV</p>
            <p className="text-xl font-bold text-red-700 mt-1">
              {fmt(kdvData.odenen_kdv || 0)}
            </p>
            <p className="text-xs text-red-500 mt-0.5">Alışlardan</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">NET ÖDENECEK KDV</p>
              <p className={`text-2xl font-bold mt-1 ${
                netKdv > 0 ? 'text-red-600' : 
                netKdv < 0 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {fmt(netKdv)}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              durum === 'ODENECEK' ? 'bg-red-100 text-red-700' : 
              durum === 'IADE_ALINACAK' ? 'bg-green-100 text-green-700' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {durum === 'ODENECEK' && '🔴 Ödenecek'}
              {durum === 'IADE_ALINACAK' && '🟢 İade Alınacak'}
              {durum === 'NOTR' && '⚪ Nötr'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-blue-600 font-semibold">%1 Matrah</p>
            <p className="text-sm font-bold text-blue-700">{fmt(kdvData.kdv1_matrahi || 0)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <p className="text-xs text-purple-600 font-semibold">%10 Matrah</p>
            <p className="text-sm font-bold text-purple-700">{fmt(kdvData.kdv10_matrahi || 0)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-xs text-amber-600 font-semibold">%20 Matrah</p>
            <p className="text-sm font-bold text-amber-700">{fmt(kdvData.kdv20_matrahi || 0)}</p>
          </div>
        </div>

        <button
          onClick={handleRaporOlustur}
          disabled={generating}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Rapor Oluşturuluyor...
            </>
          ) : (
            <>
              <Download size={16} />
              📄 KDV Raporu Oluştur
            </>
          )}
        </button>
      </div>
    </div>
  );
}