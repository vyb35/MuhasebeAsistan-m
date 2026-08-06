# backend/app/services/mutabakat_servisi.py
from models.database import DatabaseManager  
from datetime import datetime
import math

class MutabakatServisi:
    
    @staticmethod
    def mutabakat_yap(musteri_id: int, banka_hareketleri: list) -> dict:
        """Banka hareketleri ile sistemdeki belgeleri eşleştir"""
        
        print("=" * 60)
        print("MUTABAKAT BAŞLADI")
        print(f"Müşteri ID: {musteri_id}")
        print(f"Banka hareketi sayısı: {len(banka_hareketleri)}")
        print("=" * 60)
        
        # 1. Müşterinin sistemdeki belgelerini al
        belgeler = DatabaseManager.get_documents(musteri_id)  
        belge_listesi = belgeler.get('data', [])
        
        print(f"Sistemdeki belge sayısı: {len(belge_listesi)}")
        
        # 2. Banka hareketlerini temizle (nan değerlerini filtrele)
        temiz_hareketler = []
        for h in banka_hareketleri:
            tutar = h.get("tutar", 0)
            tarih = h.get("tarih", "")
            
            # nan kontrolü
            if isinstance(tutar, float) and math.isnan(tutar):
                print(f"nan tutar tespit edildi, atlanıyor: {h}")
                continue
            if isinstance(tarih, float) and math.isnan(tarih):
                print(f"nan tarih tespit edildi, atlanıyor: {h}")
                continue
            
            # Geçerli hareketleri ekle
            if tutar != 0 and tarih and tarih != 'nan':
                temiz_hareketler.append(h)
        
        print(f"Temizlenmiş banka hareketi sayısı: {len(temiz_hareketler)}")
        
        # 3. Eşleştirme yap (tutar bazında)
        eslesenler = []
        eslesmeyenler = []
        
        for idx, banka_hareketi in enumerate(temiz_hareketler):
            eslesti_mi = False
            banka_tutar = banka_hareketi.get("tutar", 0)
            banka_tarih = banka_hareketi.get("tarih", "")
            
            # Mutlak değer al (pozitif/negatif fark etmez)
            banka_tutar_abs = abs(banka_tutar)
            
            print(f"{idx}. Banka hareketi: Tarih={banka_tarih}, Tutar={banka_tutar}")
            
            for belge in belge_listesi:
                belge_tutar = belge.get('toplam_brut', 0)
                belge_tarih = belge.get('tarih', '')
                
                # Tutar eşleşmesi (1 TL hata payı) - MUTLAK DEĞER KULLAN!
                if abs(belge_tutar - banka_tutar_abs) < 1:
                    print(f"   Eşleşti! Belge: {belge.get('id')}, Tutar: {belge_tutar}, Tarih: {belge_tarih}")
                    eslesenler.append({
                        "banka_hareketi": banka_hareketi,
                        "belge": belge,
                        "durum": "ESLESTI"
                    })
                    eslesti_mi = True
                    break
            
            if not eslesti_mi:
                print(f"   Eşleşmedi! Tutar: {banka_tutar}")
                eslesmeyenler.append({
                    "banka_hareketi": banka_hareketi,
                    "durum": "ESLESMEDI"
                })
        
        # 4. Özet bilgiler (sadece temiz hareketlerden)
        toplam_banka = sum(abs(h.get("tutar", 0)) for h in temiz_hareketler)
        toplam_sistem = sum(b.get('toplam_brut', 0) for b in belge_listesi)
        
        print("=" * 60)
        print("ÖZET:")
        print(f"   Toplam Banka (mutlak): {toplam_banka}")
        print(f"   Toplam Sistem: {toplam_sistem}")
        print(f"   Fark: {toplam_banka - toplam_sistem}")
        print(f"   Eşleşen: {len(eslesenler)}")
        print(f"   Eşleşmeyen: {len(eslesmeyenler)}")
        print("=" * 60)
        
        return {
            "toplam_banka": round(toplam_banka, 2),
            "toplam_sistem": round(toplam_sistem, 2),
            "fark": round(toplam_banka - toplam_sistem, 2),
            "eslesen_sayisi": len(eslesenler),
            "eslesmeyen_sayisi": len(eslesmeyenler),
            "eslesenler": eslesenler,
            "eslesmeyenler": eslesmeyenler
        }