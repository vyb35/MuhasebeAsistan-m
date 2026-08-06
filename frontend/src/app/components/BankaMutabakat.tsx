// frontend/src/app/components/BankaMutabakat.tsx
import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2, RefreshCw } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

interface BankaMutabakatProps {
  musteriId: number;
  musteriAdi: string;
}

export function BankaMutabakat({ musteriId, musteriAdi }: BankaMutabakatProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sonuc, setSonuc] = useState<any>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [aktifSekme, setAktifSekme] = useState<'eslesen' | 'eslesmeyen'>('eslesen');
  const [sutunlar, setSutunlar] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    tarih: '',
    aciklama: '',
    tutar: '',
    bakiye: ''
  });
  const [showMapping, setShowMapping] = useState(false);
  const [mappingYapildi, setMappingYapildi] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    setFile(selected);
    setSonuc(null);
    setHata(null);
    setShowMapping(false);
    setMappingYapildi(false);
    setSutunlar([]);
    
    // Excel sütunlarını oku
    try {
      const formData = new FormData();
      formData.append('dosya', selected);
      
      const response = await fetch(`http://127.0.0.1:8000/api/excel/sutunlar`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setSutunlar(data.sutunlar || []);
        setShowMapping(true);
        
        // Otomatik tespit yap
        const autoMapping: any = {};
        for (const col of data.sutunlar) {
          const colLower = col.toLowerCase();
          if (colLower.includes('tarih') || colLower.includes('date')) {
            autoMapping.tarih = col;
          } else if (colLower.includes('tutar') || colLower.includes('amount') || colLower.includes('miktar')) {
            autoMapping.tutar = col;
          } else if (colLower.includes('aciklama') || colLower.includes('açıklama') || colLower.includes('description')) {
            autoMapping.aciklama = col;
          } else if (colLower.includes('bakiye') || colLower.includes('balance')) {
            autoMapping.bakiye = col;
          }
        }
        setMapping({
          tarih: autoMapping.tarih || data.sutunlar[0] || '',
          aciklama: autoMapping.aciklama || data.sutunlar[1] || '',
          tutar: autoMapping.tutar || data.sutunlar[2] || '',
          bakiye: autoMapping.bakiye || ''
        });
      }
    } catch (error) {
      console.error('Sütunlar okunamadı:', error);
    }
  };

  const handleMutabakat = async () => {
    if (!file) {
      alert('Lütfen bir dosya seçin!');
      return;
    }

    // Mapping kontrolü
    if (!mapping.tarih || !mapping.tutar) {
      alert('Lütfen Tarih ve Tutar sütunlarını eşleştirin!');
      return;
    }

    setUploading(true);
    setHata(null);

    const formData = new FormData();
    formData.append('dosya', file);
    
    // Mapping bilgilerini query parameter olarak gönder
    const params = new URLSearchParams();
    if (mapping.tarih) params.append('tarih_sutun', mapping.tarih);
    if (mapping.aciklama) params.append('aciklama_sutun', mapping.aciklama);
    if (mapping.tutar) params.append('tutar_sutun', mapping.tutar);
    if (mapping.bakiye) params.append('bakiye_sutun', mapping.bakiye);
    
    const url = `http://127.0.0.1:8000/api/mutabakat/${musteriId}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSonuc(data);
      setShowMapping(false);
      setMappingYapildi(true);
    } catch (error: any) {
      console.error('Mutabakat hatası:', error);
      setHata(error.message || 'Mutabakat yapılırken bir hata oluştu!');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSonuc(null);
    setHata(null);
    setShowMapping(false);
    setMappingYapildi(false);
    setSutunlar([]);
    setMapping({ tarih: '', aciklama: '', tutar: '', bakiye: '' });
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏦</span>
          <h3 className="font-semibold text-gray-800">Banka Mutabakatı</h3>
          <span className="text-xs text-gray-400 ml-2 hidden sm:inline">
            {musteriAdi}
          </span>
        </div>
        {sonuc && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>

      {/* İçerik */}
      <div className="p-5 space-y-4">
        {/* Dosya Yükleme */}
        {!sonuc && (
          <>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-500">
                Banka ekstrenizi (Excel veya CSV) seçin
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Desteklenen formatlar: .xlsx, .xls, .csv
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="mt-3 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {file && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-emerald-600">
                  <FileText size={16} />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-gray-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>

            {/* Sütun Eşleştirme */}
            {showMapping && sutunlar.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800">📊 Sütun Eşleştirme</p>
                <p className="text-xs text-blue-600">Excel'deki sütunları eşleştirin:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Tarih *</label>
                    <select
                      value={mapping.tarih}
                      onChange={(e) => setMapping({...mapping, tarih: e.target.value})}
                      className="w-full px-2 py-1.5 rounded border text-sm bg-white"
                    >
                      <option value="">Seçin</option>
                      {sutunlar.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Tutar *</label>
                    <select
                      value={mapping.tutar}
                      onChange={(e) => setMapping({...mapping, tutar: e.target.value})}
                      className="w-full px-2 py-1.5 rounded border text-sm bg-white"
                    >
                      <option value="">Seçin</option>
                      {sutunlar.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Açıklama</label>
                    <select
                      value={mapping.aciklama}
                      onChange={(e) => setMapping({...mapping, aciklama: e.target.value})}
                      className="w-full px-2 py-1.5 rounded border text-sm bg-white"
                    >
                      <option value="">Seçin</option>
                      {sutunlar.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Bakiye</label>
                    <select
                      value={mapping.bakiye}
                      onChange={(e) => setMapping({...mapping, bakiye: e.target.value})}
                      className="w-full px-2 py-1.5 rounded border text-sm bg-white"
                    >
                      <option value="">Seçin</option>
                      {sutunlar.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowMapping(false)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Eşleştirmeyi Kapat
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleMutabakat}
              disabled={!file || uploading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  İşleniyor...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  📊 Mutabakat Yap
                </>
              )}
            </button>
          </>
        )}

        {/* Hata Mesajı */}
        {hata && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{hata}</span>
          </div>
        )}

        {/* Sonuçlar */}
        {sonuc && (
          <div className="space-y-4">
            {/* Özet Kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">🏦 Banka Toplamı</p>
                <p className="text-lg font-bold text-gray-800">{fmt(sonuc.toplam_banka || 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">📄 Sistem Toplamı</p>
                <p className="text-lg font-bold text-gray-800">{fmt(sonuc.toplam_sistem || 0)}</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${
                Math.abs(sonuc.fark || 0) < 1 ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <p className="text-xs text-gray-500">📊 Fark</p>
                <p className={`text-lg font-bold ${
                  Math.abs(sonuc.fark || 0) < 1 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {fmt(sonuc.fark || 0)}
                </p>
              </div>
              <div className={`rounded-lg p-3 text-center ${
                Math.abs(sonuc.fark || 0) < 1 ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <p className="text-xs text-gray-500">Durum</p>
                <p className={`text-sm font-semibold ${
                  Math.abs(sonuc.fark || 0) < 1 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {Math.abs(sonuc.fark || 0) < 1 ? 'Uyumlu' : 'Fark Var'}
                </p>
              </div>
            </div>

            {/* Kullanılan Sütunlar */}
            {sonuc.kullanilan_sutunlar && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 flex flex-wrap gap-3">
                <span>Tarih: <strong>{sonuc.kullanilan_sutunlar.tarih}</strong></span>
                <span>Tutar: <strong>{sonuc.kullanilan_sutunlar.tutar}</strong></span>
                <span>Açıklama: <strong>{sonuc.kullanilan_sutunlar.aciklama}</strong></span>
                {sonuc.kullanilan_sutunlar.bakiye && (
                  <span>Bakiye: <strong>{sonuc.kullanilan_sutunlar.bakiye}</strong></span>
                )}
              </div>
            )}

            {/* Eşleşen / Eşleşmeyen Sekmeleri */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex border-b">
                <button
                  onClick={() => setAktifSekme('eslesen')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    aktifSekme === 'eslesen'
                      ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Eşleşen ({sonuc.eslesen_sayisi || 0})
                </button>
                <button
                  onClick={() => setAktifSekme('eslesmeyen')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    aktifSekme === 'eslesmeyen'
                      ? 'bg-red-50 text-red-700 border-b-2 border-red-500'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Eşleşmeyen ({sonuc.eslesmeyen_sayisi || 0})
                </button>
              </div>

              <div className="p-3 max-h-48 overflow-y-auto">
                {aktifSekme === 'eslesen' && (!sonuc.eslesenler || sonuc.eslesenler.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">Hiç eşleşen hareket yok</p>
                )}
                {aktifSekme === 'eslesen' && sonuc.eslesenler && sonuc.eslesenler.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{item.belge?.firma_adi || 'Bilinmiyor'}</p>
                      <p className="text-xs text-gray-400">{item.banka_hareketi?.tarih || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">{fmt(item.banka_hareketi?.tutar || 0)}</p>
                      <p className="text-xs text-emerald-500">Eşleşti</p>
                    </div>
                  </div>
                ))}

                {aktifSekme === 'eslesmeyen' && (!sonuc.eslesmeyenler || sonuc.eslesmeyenler.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">Hiç eşleşmeyen hareket yok</p>
                )}
                {aktifSekme === 'eslesmeyen' && sonuc.eslesmeyenler && sonuc.eslesmeyenler.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">
                        {item.banka_hareketi?.aciklama || 'Açıklama yok'}
                      </p>
                      <p className="text-xs text-gray-400">{item.banka_hareketi?.tarih || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">{fmt(item.banka_hareketi?.tutar || 0)}</p>
                      <p className="text-xs text-red-500">⚠️ Eşleşmedi</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Yeni Mutabakat Butonu */}
            <button
              onClick={handleReset}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Yeni Mutabakat Yap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}