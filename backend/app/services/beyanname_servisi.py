# backend/app/services/beyanname_servisi.py
from sqlalchemy import func
from datetime import datetime
from models.database import SessionLocal, Document
from collections import defaultdict
import json
from pathlib import Path
import calendar

class BeyannameServisi:
    
    @staticmethod
    def _parse_gun(tarih_str):
        """Her türlü tarih formatından günü çıkar"""
        if not tarih_str:
            return None
        
        try:
            tarih_str = str(tarih_str)
            
            # "DD.MM.YYYY" (15.08.2026)
            if '.' in tarih_str:
                return int(tarih_str.split('.')[0])
            
            # "YYYY-MM-DD" (2026-08-15)
            elif '-' in tarih_str:
                return int(tarih_str.split('-')[2])
            
            # "DD/MM/YYYY" (15/08/2026)
            elif '/' in tarih_str:
                return int(tarih_str.split('/')[0])
            
            # datetime objesi
            elif isinstance(tarih_str, datetime):
                return tarih_str.day
        except:
            pass
        
        return None
    
    @staticmethod
    def _load_kdv_map():
        """urun_gruplari.json'dan KDV oranlarını ve vergi kodlarını yükle"""
        try:
            config_path = Path(__file__).parent.parent.parent / "config" / "urun_gruplari.json"
            if config_path.exists():
                with open(config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                kdv_map = {}
                vergi_kodlari = {}
                
                for grup, detay in data.get('urun_gruplari', {}).items():
                    kdv_orani = detay.get('kdv_orani', 20)
                    vergi_kodu = detay.get('vergi_kodu', '0015')
                    
                    kdv_map[grup.upper()] = kdv_orani
                    vergi_kodlari[grup.upper()] = vergi_kodu
                    
                    for kelime in detay.get('anahtar_kelimeler', []):
                        kdv_map[kelime.upper()] = kdv_orani
                        vergi_kodlari[kelime.upper()] = vergi_kodu
                
                return kdv_map, vergi_kodlari
        except Exception as e:
            print(f"⚠️ KDV map yüklenirken hata: {e}")
        
        return {}, {}
    
    @staticmethod
    def beyanname_hazirla(musteri_id: int, ay: int, yil: int) -> dict:
        """Müşteri için KDV beyanname verisi hazırla"""
        session = SessionLocal()
        try:
            kdv_map, vergi_kodlari = BeyannameServisi._load_kdv_map()
            
            # 1. Tüm belgeleri al
            docs = session.query(Document).filter(
                Document.musteri_id == musteri_id,
                func.extract('month', func.to_date(Document.tarih, 'DD.MM.YYYY')) == ay,
                func.extract('year', func.to_date(Document.tarih, 'DD.MM.YYYY')) == yil
            ).all()
            
            # 2. Dinamik KDV matrah toplama
            kdv_matrah = defaultdict(float)
            otv_matrah = 0
            istisna_matrah = 0
            tahsil_kdv = 0
            odenen_kdv = 0
            toplam_gelir = 0
            toplam_gider = 0
            
            # BELGE YÜKLENEN GÜNLERİ TOPLA
            dolu_gunler = set()
            
            for doc in docs:
                urunler = doc.urunler or []
                tahsil_kdv += doc.tahsil_kdv or 0
                odenen_kdv += doc.odenen_kdv or 0
                
                # Akıllı tarih parse
                gun = BeyannameServisi._parse_gun(doc.tarih)
                if gun:
                    dolu_gunler.add(gun)
                
                if doc.belge_turu in ['fatura', 'fis', 'z_raporu']:
                    toplam_gelir += doc.toplam_net or 0
                else:
                    toplam_gider += doc.toplam_net or 0
                
                for urun in urunler:
                    urun_adi = urun.get('aciklama', '').upper()
                    tutar = urun.get('tutar', 0)
                    
                    kdv_orani = None
                    vergi_kodu = '0015'
                    
                    for anahtar, oran in kdv_map.items():
                        if anahtar in urun_adi or urun_adi in anahtar:
                            kdv_orani = oran
                            vergi_kodu = vergi_kodlari.get(anahtar, '0015')
                            break
                    
                    if kdv_orani is None:
                        kdv_orani = urun.get('kdv_orani', 20)
                    
                    if vergi_kodu == '0073':
                        otv_matrah += tutar
                    elif kdv_orani == 0:
                        istisna_matrah += tutar
                    else:
                        kdv_matrah[kdv_orani] += tutar
            
            # 3. KDV matrah listesini hazırla
            kdv_listesi = []
            for oran, matrah in sorted(kdv_matrah.items()):
                if matrah > 0:
                    kdv_listesi.append({
                        "oran": oran,
                        "matrah": round(matrah, 2),
                        "kdv_tutari": round(matrah * (oran / 100), 2)
                    })
            
            toplam_matrah = sum(kdv_matrah.values()) + otv_matrah + istisna_matrah
            net_kdv = tahsil_kdv - odenen_kdv
            
            # 4. EKSİK GÜN HESAPLAMA
            eksikler = []
            hatalar = []
            
            # AYIN TOPLAM GÜN SAYISI (28, 29, 30 veya 31)
            gun_sayisi = calendar.monthrange(yil, ay)[1]
            
            # EKSİK GÜNLER
            tum_gunler = set(range(1, gun_sayisi + 1))
            eksik_gunler = tum_gunler - dolu_gunler
            
            if eksik_gunler:
                eksik_gun_listesi = sorted(eksik_gunler)
                
                # Eğer 10'dan fazla eksik varsa, sadece sayıyı göster
                if len(eksik_gun_listesi) > 10:
                    eksikler.append(f"{len(eksik_gun_listesi)} gün eksik")
                else:
                    eksikler.append(f"Eksik günler: {', '.join(map(str, eksik_gun_listesi))}")
            else:
                eksikler.append("Tüm günler tamamlandı")
            
            if toplam_matrah == 0:
                hatalar.append("Matrah bilgisi bulunamadı")
            
            return {
                "status": "success",
                "data": {
                    "musteri_id": musteri_id,
                    "donem": f"{ay}/{yil}",
                    "kdv_listesi": kdv_listesi,
                    "otv_matrah": round(otv_matrah, 2),
                    "istisna_matrah": round(istisna_matrah, 2),
                    "toplam_matrah": round(toplam_matrah, 2),
                    "tahsil_kdv": round(tahsil_kdv, 2),
                    "odenen_kdv": round(odenen_kdv, 2),
                    "net_kdv": round(net_kdv, 2),
                    "toplam_gelir": round(toplam_gelir, 2),
                    "toplam_gider": round(toplam_gider, 2),
                    "belge_sayisi": len(docs),
                    "dolu_gun_sayisi": len(dolu_gunler),
                    "toplam_gun_sayisi": gun_sayisi,
                    "durum": "ODENECEK" if net_kdv > 0 else "IADE_ALINACAK" if net_kdv < 0 else "NOTR",
                    "eksikler": eksikler,
                    "hatalar": hatalar,
                    "hazirlanma_tarihi": datetime.now().isoformat()
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()