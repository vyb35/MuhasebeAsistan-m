# backend/app/services/kdv_servisi.py
from sqlalchemy import func
from datetime import datetime
from models.database import SessionLocal, Document

class KDVServisi:
    
    @staticmethod
    def kdv_hesapla(musteri_id: int, ay: int, yil: int) -> dict:
        """Müşterinin KDV durumunu hesapla"""
        session = SessionLocal()
        try:
            # Tüm belgeleri al (tarih filtresi ile)
            docs = session.query(Document).filter(
                Document.musteri_id == musteri_id,
                func.extract('month', func.to_date(Document.tarih, 'DD.MM.YYYY')) == ay,
                func.extract('year', func.to_date(Document.tarih, 'DD.MM.YYYY')) == yil
            ).all()
            
            # Tahsil KDV (Gelir)
            tahsil_kdv = sum(d.tahsil_kdv for d in docs)
            
            # Ödenen KDV (Gider)
            odenen_kdv = sum(d.odenen_kdv for d in docs)
            
            # Net KDV
            net_kdv = tahsil_kdv - odenen_kdv
            
            # KDV Matrah Dağılımı
            kdv1_matrahi = 0
            kdv10_matrahi = 0
            kdv20_matrahi = 0
            
            for doc in docs:
                urunler = doc.urunler or []
                for urun in urunler:
                    oran = urun.get('kdv_orani', 20)
                    tutar = urun.get('tutar', 0)
                    if oran == 1:
                        kdv1_matrahi += tutar
                    elif oran == 10:
                        kdv10_matrahi += tutar
                    else:
                        kdv20_matrahi += tutar
            
            # Durum belirleme
            if net_kdv > 0:
                durum = "ODENECEK"
            elif net_kdv < 0:
                durum = "IADE_ALINACAK"
            else:
                durum = "NOTR"
            
            return {
                "status": "success",
                "data": {
                    "musteri_id": musteri_id,
                    "donem": f"{ay}/{yil}",
                    "tahsil_kdv": round(tahsil_kdv, 2),
                    "odenen_kdv": round(odenen_kdv, 2),
                    "net_kdv": round(net_kdv, 2),
                    "kdv1_matrahi": round(kdv1_matrahi, 2),
                    "kdv10_matrahi": round(kdv10_matrahi, 2),
                    "kdv20_matrahi": round(kdv20_matrahi, 2),
                    "durum": durum,
                    "guncelleme_tarihi": datetime.now().isoformat()
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()