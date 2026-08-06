# backend/app/services/banka_servisi.py
import pandas as pd
import pdfplumber
import csv
import json
import os
import re
from datetime import datetime

class BankaServisi:
    
    @staticmethod
    def dosya_oku(dosya_yolu: str, dosya_adi: str, mapping: dict = None) -> list:
        """Dosya uzantısına göre doğru okuyucuyu çağır"""
        uzanti = dosya_adi.split('.')[-1].lower() if '.' in dosya_adi else ''
        print(f"📁 Dosya okunuyor: {dosya_adi}, Uzantı: {uzanti}")
        
        if uzanti == 'pdf':
            return BankaServisi.pdf_oku(dosya_yolu)
        elif uzanti in ['xlsx', 'xls']:
            return BankaServisi.excel_oku(dosya_yolu, mapping)
        elif uzanti == 'csv':
            return BankaServisi.csv_oku(dosya_yolu, mapping)
        elif uzanti in ['txt']:
            return BankaServisi.txt_oku(dosya_yolu)
        elif uzanti in ['json']:
            return BankaServisi.json_oku(dosya_yolu)
        else:
            print(f"Desteklenmeyen format: {uzanti}")
            return []
    
    @staticmethod
    def excel_oku(dosya_yolu: str, mapping: dict = None) -> list:
        """Excel dosyasını akıllıca oku - HER TÜRLÜ FORMATI DESTEKLER"""
        print("📊 Akıllı Excel okuyucu başlatılıyor...")
        print(f"📊 Dosya: {dosya_yolu}")
        
        try:
            # Eğer mapping varsa, header ile oku (sütun adlarıyla eşleştirme yapabilmek için)
            if mapping:
                print(f"📊 Mapping ile okunuyor: {mapping}")
                df = pd.read_excel(dosya_yolu)
                print(f"📊 Sütunlar: {df.columns.tolist()}")
                return BankaServisi._mapping_ile_oku(df, mapping)
            
            # Mapping yoksa header None ile dene (ham veri)
            df = pd.read_excel(dosya_yolu, header=None)
            print(f"📊 Ham veri boyutu: {df.shape}")
            
            # Otomatik analiz yap
            analiz = BankaServisi._analiz_et(df)
            print(f"📊 Analiz sonucu: {analiz['tip']}")
            
            if analiz['tip'] == 'FATURA':
                return BankaServisi._fatura_oku(df, analiz)
            elif analiz['tip'] == 'FIS':
                return BankaServisi._fis_oku(df, analiz)
            elif analiz['tip'] == 'BANKA_EXTRESI':
                return BankaServisi._banka_oku(df, analiz)
            elif analiz['tip'] == 'TABLO':
                return BankaServisi._tablo_oku(df, analiz)
            else:
                print("Bilinmeyen format, ilk satır başlık olarak deneniyor...")
                return BankaServisi._ilk_satir_baslik_oku(df)
                
        except Exception as e:
            print(f"❌ Excel okuma hatası: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    @staticmethod
    def _ilk_satir_baslik_oku(df: pd.DataFrame) -> list:
        """İlk satırı başlık olarak kabul et ve oku"""
        print("📊 İlk satır başlık olarak okunuyor...")
        
        # İlk satırı başlık olarak al
        basliklar = df.iloc[0].astype(str).tolist()
        print(f"📊 Başlıklar: {basliklar}")
        
        # Başlıkları normalize et
        sutun_map = {}
        for i, baslik in enumerate(basliklar):
            baslik_lower = str(baslik).lower().strip()
            if 'tarih' in baslik_lower or 'date' in baslik_lower:
                sutun_map['tarih'] = i
            elif 'tutar' in baslik_lower or 'amount' in baslik_lower or 'miktar' in baslik_lower:
                sutun_map['tutar'] = i
            elif 'aciklama' in baslik_lower or 'açıklama' in baslik_lower or 'description' in baslik_lower:
                sutun_map['aciklama'] = i
            elif 'bakiye' in baslik_lower or 'balance' in baslik_lower:
                sutun_map['bakiye'] = i
        
        # Verileri oku (başlık satırından sonra)
        hareketler = []
        for idx in range(1, len(df)):
            row = df.iloc[idx].astype(str).tolist()
            
            # Boş satır kontrol et
            if not any(pd.notna(x) for x in df.iloc[idx]):
                continue
            
            tarih = row[sutun_map.get('tarih', 0)] if sutun_map.get('tarih') is not None and len(row) > sutun_map.get('tarih', 0) else ''
            tutar = row[sutun_map.get('tutar', 1)] if sutun_map.get('tutar') is not None and len(row) > sutun_map.get('tutar', 1) else 0
            aciklama = row[sutun_map.get('aciklama', 2)] if sutun_map.get('aciklama') is not None and len(row) > sutun_map.get('aciklama', 2) else ''
            bakiye = row[sutun_map.get('bakiye', 3)] if sutun_map.get('bakiye') is not None and len(row) > sutun_map.get('bakiye', 3) else None
            
            # Tutarı float'a çevir
            try:
                if isinstance(tutar, str):
                    tutar = float(tutar.replace(',', '.'))
                else:
                    tutar = float(tutar)
            except:
                tutar = 0
            
            if tutar != 0 or (tarih and tarih != 'nan'):
                hareketler.append({
                    "tarih": tarih if tarih != 'nan' else '',
                    "aciklama": aciklama if aciklama != 'nan' else '',
                    "tutar": tutar,
                    "bakiye": bakiye if bakiye != 'nan' else None
                })
        
        print(f"{len(hareketler)} hareket okundu (ilk satır başlık yöntemi)")
        return hareketler
    
    @staticmethod
    def _analiz_et(df: pd.DataFrame) -> dict:
        """Excel verisini analiz et ve tipini belirle"""
        analiz = {
            'tip': 'BILINMIYOR',
            'fatura_bilgileri': {},
            'urun_satiri': None,
            'toplam_satiri': None,
            'sutunlar': []
        }
        
        print("🔍 Excel analiz ediliyor...")
        
        for i, row in df.iterrows():
            satir = row.astype(str).tolist()
            satir_str = ' '.join(satir).upper()
            
            if 'FATURA NO' in satir_str or 'FATURA TARİHİ' in satir_str:
                analiz['tip'] = 'FATURA'
                print(f"   Fatura tespit edildi (satır {i})")
                for j, val in enumerate(satir):
                    val_str = str(val).upper()
                    if 'FATURA NO' in val_str and j+1 < len(satir):
                        analiz['fatura_bilgileri']['no'] = str(satir[j+1])
                    if 'FATURA TARİHİ' in val_str and j+1 < len(satir):
                        analiz['fatura_bilgileri']['tarih'] = str(satir[j+1])
                    if 'ARA TOPLAM' in val_str and j+1 < len(satir):
                        analiz['fatura_bilgileri']['ara_toplam'] = str(satir[j+1])
                    if 'KDV' in val_str and '%' in val_str and j+1 < len(satir):
                        analiz['fatura_bilgileri']['kdv'] = str(satir[j+1])
                    if 'GENEL TOPLAM' in val_str and j+1 < len(satir):
                        analiz['fatura_bilgileri']['genel_toplam'] = str(satir[j+1])
                continue
            
            if any(k in satir_str for k in ['FİŞ NO', 'FIS NO']):
                analiz['tip'] = 'FIS'
                print(f"   Fiş tespit edildi (satır {i})")
                continue
            
            if any(k in satir_str for k in ['ÜRÜN/HİZMET', 'ÜRÜN/HIZMET', 'ÜRÜN ADI', 'ÜRÜN', 'HİZMET']):
                if analiz['urun_satiri'] is None:
                    analiz['urun_satiri'] = i
                    analiz['sutunlar'] = [str(x).strip() for x in row if pd.notna(x)]
                    print(f"   📋 Ürün başlığı tespit edildi (satır {i})")
                continue
            
            if 'TARİH' in satir_str and 'TUTAR' in satir_str:
                if analiz['urun_satiri'] is None:
                    analiz['urun_satiri'] = i
                    analiz['sutunlar'] = [str(x).strip() for x in row if pd.notna(x)]
                    print(f"   📋 Tablo başlığı tespit edildi (satır {i})")
                continue
            
            if 'BAKİYE' in satir_str and ('TARİH' in satir_str or 'AÇIKLAMA' in satir_str):
                analiz['tip'] = 'BANKA_EXTRESI'
                analiz['urun_satiri'] = i
                analiz['sutunlar'] = [str(x).strip() for x in row if pd.notna(x)]
                print(f"   Banka ekstresi tespit edildi (satır {i})")
                continue
        
        if analiz['tip'] == 'BILINMIYOR' and analiz['urun_satiri'] is not None:
            analiz['tip'] = 'TABLO'
            print(f"   📋 Tablo formatı olarak kabul edildi")
            if not analiz['sutunlar']:
                analiz['sutunlar'] = [f'Sütun_{i}' for i in range(len(df.columns))]
        
        print(f"📊 Analiz tamamlandı: {analiz['tip']}")
        return analiz
    
    @staticmethod
    def _fatura_oku(df: pd.DataFrame, analiz: dict) -> list:
        """Fatura formatındaki Excel'den veri çıkar - KDV ORANINI OKUR!"""
        print("📊 Fatura formatı tespit edildi!")
        
        bilgiler = analiz.get('fatura_bilgileri', {})
        tarih = bilgiler.get('tarih', '')
        firma = ''
        kdv_orani = 0
        
        # Firma adını bul
        for i in range(min(5, len(df))):
            satir = df.iloc[i].astype(str).tolist()
            if satir and len(satir) > 0:
                deger = str(satir[0]).strip()
                if deger and deger != 'nan' and not any(k in deger.upper() for k in ['FATURA', 'VKN:', 'TARİH', 'NO:', 'ÜRÜN', 'ARA TOPLAM', 'KDV']):
                    firma = deger
                    break
        
        if not firma:
            firma = "Excel Yükleme"
        
        urunler = []
        ara_toplam = 0
        kdv = 0
        genel_toplam = 0
        
        # Önce KDV oranını bul (Tüm satırları tara)
        for i, row in df.iterrows():
            satir = row.astype(str).tolist()
            satir_str = ' '.join(satir).upper()
            
            if 'KDV' in satir_str and '%' in satir_str:
                for j, val in enumerate(satir):
                    val_str = str(val).upper()
                    if 'KDV' in val_str and '%' in val_str:
                        match = re.search(r'%(\d+)', str(val))
                        if match:
                            kdv_orani = int(match.group(1))
                            print(f"📊 KDV oranı: %{kdv_orani} tespit edildi!")
                            # KDV tutarını da al
                            if j + 1 < len(satir):
                                try:
                                    kdv = float(str(satir[j+1]).replace(',', '.'))
                                except:
                                    pass
                        break
                if kdv_orani > 0:
                    break  # Bulduysak daha fazla aramaya gerek yok
        
        # Ürünleri oku
        if analiz.get('urun_satiri') is not None:
            for i in range(analiz['urun_satiri'] + 1, len(df)):
                row = df.iloc[i].astype(str).tolist()
                satir_str = ' '.join(row).upper()
                
                # Toplam satırı kontrol et
                if any(k in satir_str for k in ['ARA TOPLAM', 'GENEL TOPLAM', 'TOPLAM']):
                    continue
                
                # Boş satır kontrol et
                if not any(pd.notna(x) for x in row):
                    break
                
                # Ürün bilgilerini çıkar
                urun_adi = str(row[0]).strip() if len(row) > 0 and pd.notna(row[0]) and str(row[0]) != 'nan' else ''
                urun_tutar = 0
                
                # Tutarı bul (son sütun genelde tutardır)
                for j in range(len(row)-1, -1, -1):
                    if pd.notna(row[j]) and j > 0:
                        try:
                            urun_tutar = float(str(row[j]).replace(',', '.'))
                            break
                        except:
                            continue
                
                if urun_adi and urun_adi not in ['nan', ''] and urun_tutar > 0:
                    urunler.append({
                        "grup": "GIDA",
                        "aciklama": urun_adi,
                        "tutar": round(urun_tutar, 2),
                        "kdv_orani": kdv_orani if kdv_orani > 0 else 0
                    })
                    ara_toplam += urun_tutar
        
        # Eğer KDV bulunamadıysa, oranı kullanarak hesapla
        if kdv == 0 and kdv_orani > 0 and ara_toplam > 0:
            kdv = ara_toplam * (kdv_orani / 100)
            print(f"📊 KDV hesaplandı: {kdv} TL (%{kdv_orani})")
        
        genel_toplam = ara_toplam + kdv
        
        if bilgiler.get('genel_toplam'):
            try:
                genel_toplam = float(str(bilgiler['genel_toplam']).replace(',', '.'))
            except:
                pass
        
        print(f"📊 Fatura okundu: {len(urunler)} ürün, KDV oranı: %{kdv_orani}, Toplam: {genel_toplam}")
        
        return [{
            "tarih": tarih,
            "firma_adi": firma,
            "aciklama": firma,
            "tutar": genel_toplam,
            "urunler": urunler,
            "ara_toplam": round(ara_toplam, 2),
            "kdv": round(kdv, 2),
            "kdv_orani": kdv_orani,
            "genel_toplam": round(genel_toplam, 2)
        }]
    
    @staticmethod
    def _fis_oku(df: pd.DataFrame, analiz: dict) -> list:
        """Fiş formatındaki Excel'den veri çıkar"""
        print("📊 Fiş formatı tespit edildi!")
        return BankaServisi._fatura_oku(df, analiz)
    
    @staticmethod
    def _banka_oku(df: pd.DataFrame, analiz: dict) -> list:
        """Banka ekstresi formatındaki Excel'den veri çıkar"""
        print("📊 Banka ekstresi formatı tespit edildi!")
        
        if analiz['urun_satiri'] is None:
            return BankaServisi._ilk_satir_baslik_oku(df)
        
        sutun_indeksleri = {}
        for i, col in enumerate(analiz['sutunlar']):
            col_lower = col.lower()
            if 'tarih' in col_lower or 'date' in col_lower:
                sutun_indeksleri['tarih'] = i
            elif 'tutar' in col_lower or 'amount' in col_lower or 'miktar' in col_lower:
                sutun_indeksleri['tutar'] = i
            elif 'aciklama' in col_lower or 'açıklama' in col_lower or 'description' in col_lower:
                sutun_indeksleri['aciklama'] = i
            elif 'bakiye' in col_lower or 'balance' in col_lower:
                sutun_indeksleri['bakiye'] = i
        
        hareketler = []
        for i in range(analiz['urun_satiri'] + 1, len(df)):
            row = df.iloc[i].astype(str).tolist()
            if not any(pd.notna(x) for x in row):
                break
            
            tarih = row[sutun_indeksleri.get('tarih', 0)] if sutun_indeksleri.get('tarih') is not None and len(row) > sutun_indeksleri.get('tarih', 0) else ''
            tutar = row[sutun_indeksleri.get('tutar', 1)] if sutun_indeksleri.get('tutar') is not None and len(row) > sutun_indeksleri.get('tutar', 1) else 0
            aciklama = row[sutun_indeksleri.get('aciklama', 2)] if sutun_indeksleri.get('aciklama') is not None and len(row) > sutun_indeksleri.get('aciklama', 2) else ''
            bakiye = row[sutun_indeksleri.get('bakiye', 3)] if sutun_indeksleri.get('bakiye') is not None and len(row) > sutun_indeksleri.get('bakiye', 3) else None
            
            try:
                if isinstance(tutar, str):
                    tutar = float(tutar.replace(',', '.'))
                else:
                    tutar = float(tutar)
            except:
                tutar = 0
            
            if tutar != 0:
                hareketler.append({
                    "tarih": tarih if tarih != 'nan' else '',
                    "aciklama": aciklama if aciklama != 'nan' else '',
                    "tutar": tutar,
                    "bakiye": bakiye if bakiye != 'nan' else None
                })
        
        return hareketler
    
    @staticmethod
    def _tablo_oku(df: pd.DataFrame, analiz: dict) -> list:
        """Tablo formatındaki Excel'den veri çıkar"""
        print("📊 Tablo formatı tespit edildi!")
        return BankaServisi._banka_oku(df, analiz)
    
    @staticmethod
    def _mapping_ile_oku(df: pd.DataFrame, mapping: dict) -> list:
        """Kullanıcı mapping'i ile oku - SÜTUN ADLARI İLE EŞLEŞTİR"""
        print(f"📊 Mapping ile okunuyor (sütun adları): {mapping}")
        
        sutunlar = df.columns.tolist()
        print(f"📊 Sütunlar: {sutunlar}")
        
        tarih_col = None
        aciklama_col = None
        tutar_col = None
        bakiye_col = None
        
        for col in sutunlar:
            col_str = str(col).strip()
            if col_str == mapping.get('tarih', ''):
                tarih_col = col
            elif col_str == mapping.get('aciklama', ''):
                aciklama_col = col
            elif col_str == mapping.get('tutar', ''):
                tutar_col = col
            elif col_str == mapping.get('bakiye', ''):
                bakiye_col = col
        
        print(f"📊 Bulunan sütunlar: Tarih={tarih_col}, Tutar={tutar_col}, Açıklama={aciklama_col}, Bakiye={bakiye_col}")
        
        hareketler = []
        for idx, row in df.iterrows():
            try:
                tarih = row[tarih_col] if tarih_col is not None else ''
                tutar = row[tutar_col] if tutar_col is not None else 0
                aciklama = row[aciklama_col] if aciklama_col is not None else ''
                bakiye = row[bakiye_col] if bakiye_col is not None else None
                
                if isinstance(tutar, str):
                    tutar = float(tutar.replace(',', '.'))
                else:
                    tutar = float(tutar) if tutar is not None else 0
                
                if isinstance(tarih, pd.Timestamp):
                    tarih = tarih.strftime('%d.%m.%Y')
                else:
                    tarih = str(tarih) if tarih is not None else ''
                
                if tutar != 0 or tarih:
                    hareketler.append({
                        "tarih": tarih,
                        "aciklama": str(aciklama) if aciklama is not None else '',
                        "tutar": tutar,
                        "bakiye": float(bakiye) if bakiye is not None else None
                    })
            except Exception as e:
                print(f"{idx}. satır okunamadı: {e}")
                continue
        
        print(f"{len(hareketler)} hareket okundu (mapping ile)")
        return hareketler
    
    @staticmethod
    def _tutar_cevir(tutar) -> float:
        """Tutarı float'a çevir"""
        if tutar is None:
            return 0
        try:
            if isinstance(tutar, str):
                tutar_clean = tutar.replace('₺', '').replace('TL', '').replace('$', '').replace('€', '').strip()
                tutar_clean = tutar_clean.replace('.', '').replace(',', '.')
                return float(tutar_clean)
            else:
                return float(tutar)
        except:
            return 0
    
    @staticmethod
    def csv_oku(dosya_yolu: str, mapping: dict = None) -> list:
        """CSV dosyasından banka hareketlerini oku"""
        print("📊 CSV okunuyor...")
        hareketler = []
        
        for encoding in ['utf-8', 'iso-8859-9', 'windows-1254']:
            try:
                with open(dosya_yolu, 'r', encoding=encoding) as file:
                    first_line = file.readline()
                    if ';' in first_line:
                        delimiter = ';'
                    elif '\t' in first_line:
                        delimiter = '\t'
                    else:
                        delimiter = ','
                    
                    file.seek(0)
                    reader = csv.DictReader(file, delimiter=delimiter)
                    sutunlar = reader.fieldnames or []
                    print(f"📊 CSV sütunları: {sutunlar}")
                    
                    if not mapping:
                        tarih_col, aciklama_col, tutar_col, bakiye_col = BankaServisi._otomatik_tespit(sutunlar)
                    else:
                        tarih_col = mapping.get('tarih')
                        aciklama_col = mapping.get('aciklama')
                        tutar_col = mapping.get('tutar')
                        bakiye_col = mapping.get('bakiye')
                    
                    for row in reader:
                        tarih = row.get(tarih_col, '') if tarih_col else ''
                        aciklama = row.get(aciklama_col, '') if aciklama_col else ''
                        tutar = row.get(tutar_col, 0) if tutar_col else 0
                        bakiye = row.get(bakiye_col, None) if bakiye_col else None
                        
                        hareketler.append({
                            "tarih": str(tarih),
                            "aciklama": str(aciklama),
                            "tutar": BankaServisi._tutar_cevir(tutar),
                            "bakiye": BankaServisi._tutar_cevir(bakiye) if bakiye else None
                        })
                    break
            except Exception as e:
                print(f"CSV okuma denemesi başarısız: {e}")
                continue
        
        print(f"{len(hareketler)} CSV hareket okundu")
        return hareketler
    
    @staticmethod
    def _otomatik_tespit(sutunlar: list) -> tuple:
        """Sütun isimlerine göre otomatik eşleştirme"""
        tarih_col = None
        aciklama_col = None
        tutar_col = None
        bakiye_col = None
        
        for col in sutunlar:
            col_lower = col.lower().strip()
            
            if any(k in col_lower for k in ['tarih', 'date', 'işlem tarihi', 'işlemtarihi']):
                tarih_col = col
            elif any(k in col_lower for k in ['tutar', 'amount', 'miktar', 'brüt', 'tutarı']):
                tutar_col = col
            elif any(k in col_lower for k in ['aciklama', 'açıklama', 'description', 'işlem', 'açiklama']):
                aciklama_col = col
            elif any(k in col_lower for k in ['bakiye', 'balance']):
                bakiye_col = col
        
        return tarih_col, aciklama_col, tutar_col, bakiye_col
    
    @staticmethod
    def pdf_oku(dosya_yolu: str) -> list:
        """PDF dosyasından banka hareketlerini oku (basit)"""
        print("PDF okunuyor...")
        hareketler = []
        try:
            with pdfplumber.open(dosya_yolu) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    print(f"PDF sayfa {page.page_number}: {len(text)} karakter")
        except Exception as e:
            print(f"PDF okuma hatası: {e}")
        return hareketler
    
    @staticmethod
    def txt_oku(dosya_yolu: str) -> list:
        """Metin dosyasından banka hareketlerini oku"""
        print("TXT okunuyor...")
        hareketler = []
        try:
            with open(dosya_yolu, 'r', encoding='utf-8') as file:
                lines = file.readlines()
                for line in lines:
                    parts = line.strip().split('\t')
                    if len(parts) >= 3:
                        hareketler.append({
                            "tarih": parts[0] if len(parts) > 0 else "",
                            "aciklama": parts[1] if len(parts) > 1 else "",
                            "tutar": BankaServisi._tutar_cevir(parts[2]) if len(parts) > 2 else 0,
                            "bakiye": None
                        })
        except Exception as e:
            print(f"Metin okuma hatası: {e}")
        print(f"{len(hareketler)} TXT hareket okundu")
        return hareketler
    
    @staticmethod
    def json_oku(dosya_yolu: str) -> list:
        """JSON dosyasından banka hareketlerini oku"""
        print("JSON okunuyor...")
        hareketler = []
        try:
            with open(dosya_yolu, 'r', encoding='utf-8') as file:
                data = json.load(file)
                if isinstance(data, list):
                    for item in data:
                        hareketler.append({
                            "tarih": str(item.get("tarih", item.get("date", ""))),
                            "aciklama": str(item.get("aciklama", item.get("description", ""))),
                            "tutar": BankaServisi._tutar_cevir(item.get("tutar", item.get("amount", 0))),
                            "bakiye": BankaServisi._tutar_cevir(item.get("bakiye", item.get("balance", None))) if item.get("bakiye") else None
                        })
                elif isinstance(data, dict) and 'hareketler' in data:
                    for item in data['hareketler']:
                        hareketler.append({
                            "tarih": str(item.get("tarih", item.get("date", ""))),
                            "aciklama": str(item.get("aciklama", item.get("description", ""))),
                            "tutar": BankaServisi._tutar_cevir(item.get("tutar", item.get("amount", 0))),
                            "bakiye": BankaServisi._tutar_cevir(item.get("bakiye", item.get("balance", None))) if item.get("bakiye") else None
                        })
        except Exception as e:
            print(f"⚠️ JSON okuma hatası: {e}")
        print(f"✅ {len(hareketler)} JSON hareket okundu")
        return hareketler