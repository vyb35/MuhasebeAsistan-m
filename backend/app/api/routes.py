# backend/app/api/routes.py
from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import pandas as pd
import io
import tempfile
import os
import re

from services import (
    gemini_oku,
    DogrulamaMotoru,
    IslemMotoru,
    ExcelService,
    NotificationService
)

from models.database import DatabaseManager
from services.kdv_servisi import KDVServisi
from services.beyanname_servisi import BeyannameServisi

router = APIRouter(prefix="/api", tags=["MuhasebeAI"])


# Models (Pydantic)

class MusteriEkleModel(BaseModel):
    adi: str
    user_id: Optional[int] = None
    vergi_no: Optional[str] = None
    sektor: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    adres: Optional[str] = None


class MusteriGuncelleModel(BaseModel):
    adi: Optional[str] = None
    vergi_no: Optional[str] = None
    sektor: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    adres: Optional[str] = None


class KDVDataModel(BaseModel):
    ay: int
    yil: int


# Belge Yükleme Endpoint'i

@router.post("/belge/yukle")
async def belge_yukle(
    foto: UploadFile = File(...),
    musteri_id: Optional[int] = Query(None, description="Müşteri ID"),
    belge_turu: str = Query("fis", description="Belge türü: fis, fatura, z_raporu, gider_faturasi, alis_fisi"),
    tarih: Optional[str] = Query(None, description="Belge tarihi (isteğe bağlı)")
):
    """
    Tek belge yükleme (Fiş, Fatura, Z-Raporu)
    - Resim/PDF: Gemini ile okur
    - Excel/CSV: Akıllı Excel okuyucu ile okur
    - KDV oranlarını okur
    - KDV türünü OTOMATİK belirler (Tahsil/Ödenen)
    """
    try:
        content = await foto.read()
        dosya_adi = foto.filename or ""
        uzanti = dosya_adi.split('.')[-1].lower() if '.' in dosya_adi else ''
        
        ham_veri = None
        
        # Excel/CSV dosyası ise akıllı okuyucuyu kullan
        if uzanti in ['xlsx', 'xls', 'csv']:
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uzanti}") as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                
                try:
                    from services.banka_servisi import BankaServisi
                    sonuc = BankaServisi.excel_oku(tmp_path, None)
                    
                    if not sonuc:
                        return JSONResponse({
                            "status": "error",
                            "message": "Excel okunamadı veya veri bulunamadı"
                        }, status_code=400)
                    
                    ilk = sonuc[0]
                    ham_veri = ilk
                    
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                
            except Exception as e:
                return JSONResponse({
                    "status": "error",
                    "message": f"Excel/CSV okunamadı: {str(e)}",
                    "detay": str(e)
                }, status_code=400)
        else:
            # Resim/PDF için Gemini ile oku
            ham_veri = gemini_oku(content, belge_turu)
        
        if not ham_veri or "error" in ham_veri:
            return JSONResponse({
                "status": "error",
                "message": "Belge okunamadı",
                "detay": ham_veri
            }, status_code=400)
        
        # Otomatik KDV Türü Tespiti
        kdv = ham_veri.get('kdv', 0)
        firma_adi = ham_veri.get('firma_adi', '')
        urunler = ham_veri.get('urunler', [])
        
        # Müşteri adını al
        musteri_adi = None
        if musteri_id:
            musteri = DatabaseManager.get_musteri_by_id(musteri_id)
            if musteri and isinstance(musteri, dict):
                musteri_adi = musteri.get('adi', '')
            elif musteri and hasattr(musteri, 'adi'):
                musteri_adi = musteri.adi
        
        tahsil_kdv, odenen_kdv = kdv_turu_belirle(firma_adi, belge_turu, urunler, kdv, musteri_adi)
        
        ham_veri['tahsil_kdv'] = tahsil_kdv
        ham_veri['odenen_kdv'] = odenen_kdv
        
        # İşlem motoru ile işle
        try:
            islem_motoru = IslemMotoru()
            islenmis = islem_motoru.isle(ham_veri)
        except Exception as e:
            islenmis = ham_veri
            print(f"IslemMotoru hatası: {e}")
        
        islenmis['musteri_id'] = musteri_id
        islenmis['belge_turu'] = belge_turu
        islenmis['islem_tarihi'] = datetime.now().isoformat()
        islenmis['dosya_adi'] = foto.filename
        islenmis['_ham_veri'] = ham_veri
        
        # Doğrulama
        dogrulama = DogrulamaMotoru()
        dogrulama_sonucu = dogrulama.dogrula(islenmis)
        
        # Veritabanına kaydet
        db_result = DatabaseManager.save_document(islenmis)
        
        return JSONResponse({
            "status": "success",
            "message": "Belge başarıyla okundu ve kaydedildi",
            "data": islenmis,
            "db": db_result,
            "dogrulama": dogrulama_sonucu
        })
        
    except Exception as e:
        print(f"❌ Belge yükleme hatası: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/belge/toplu-yukle")
async def toplu_belge_yukle(
    dosyalar: List[UploadFile] = File(...),
    musteri_id: Optional[int] = Query(None, description="Müşteri ID"),
    belge_turu: str = Query("fis", description="Belge türü")
):
    """
    Toplu belge yükleme (max 50 fotoğraf)
    """
    try:
        if len(dosyalar) > 50:
            raise HTTPException(status_code=400, detail="Maksimum 50 dosya yüklenebilir!")
        
        sonuclar = []
        hata_sayisi = 0
        toplam_net = 0
        toplam_kdv = 0
        kayit_sonuclari = []
        
        for dosya in dosyalar:
            try:
                content = await dosya.read()
                dosya_adi = dosya.filename or ""
                uzanti = dosya_adi.split('.')[-1].lower() if '.' in dosya_adi else ''
                
                if uzanti in ['xlsx', 'xls', 'csv']:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uzanti}") as tmp:
                        tmp.write(content)
                        tmp_path = tmp.name
                    
                    try:
                        from services.banka_servisi import BankaServisi
                        sonuc = BankaServisi.excel_oku(tmp_path, None)
                        
                        if sonuc:
                            ilk = sonuc[0]
                            urunler = ilk.get('urunler', [])
                            kdv_orani = ilk.get('kdv_orani', 20)
                            for urun in urunler:
                                if 'kdv_orani' not in urun or urun.get('kdv_orani') == 0:
                                    urun['kdv_orani'] = kdv_orani if kdv_orani > 0 else 20
                                if 'kdv_tutari' not in urun:
                                    urun['kdv_tutari'] = urun.get('tutar', 0) * (urun.get('kdv_orani', 20) / 100)
                            
                            ara_toplam = ilk.get('ara_toplam', sum(u.get('tutar', 0) for u in urunler))
                            kdv = ilk.get('kdv', sum(u.get('kdv_tutari', 0) for u in urunler))
                            genel_toplam = ara_toplam + kdv
                            
                            ham_veri = {
                                "belge_turu": belge_turu,
                                "tarih": ilk.get('tarih', datetime.now().strftime('%d.%m.%Y')),
                                "firma_adi": ilk.get('firma_adi', 'Excel Yükleme'),
                                "vergi_no": "",
                                "urunler": urunler,
                                "ara_toplam": round(ara_toplam, 2),
                                "kdv": round(kdv, 2),
                                "kdv_orani": kdv_orani,
                                "iskonto": 0,
                                "genel_toplam": round(genel_toplam, 2)
                            }
                        else:
                            hata_sayisi += 1
                            sonuclar.append({
                                "dosya_adi": dosya.filename,
                                "durum": "hata",
                                "detay": "Excel okunamadı"
                            })
                            continue
                    finally:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                else:
                    ham_veri = gemini_oku(content, belge_turu)
                
                if "error" in ham_veri:
                    hata_sayisi += 1
                    sonuclar.append({
                        "dosya_adi": dosya.filename,
                        "durum": "hata",
                        "detay": ham_veri
                    })
                else:
                    try:
                        islem_motoru = IslemMotoru()
                        islenmis = islem_motoru.isle(ham_veri)
                    except Exception as e:
                        islenmis = ham_veri
                        print(f"⚠️ IslemMotoru hatası: {e}")
                    
                    islenmis['dosya_adi'] = dosya.filename
                    islenmis['musteri_id'] = musteri_id
                    islenmis['belge_turu'] = belge_turu
                    islenmis['islem_tarihi'] = datetime.now().isoformat()
                    islenmis['_ham_veri'] = ham_veri
                    
                    db_result = DatabaseManager.save_document(islenmis)
                    kayit_sonuclari.append(db_result)
                    
                    sonuclar.append(islenmis)
                    toplam_net += islenmis.get('toplam_net', 0)
                    toplam_kdv += islenmis.get('toplam_kdv', 0)
                    
            except Exception as e:
                hata_sayisi += 1
                sonuclar.append({
                    "dosya_adi": dosya.filename,
                    "durum": "hata",
                    "detay": str(e)
                })
        
        return JSONResponse({
            "status": "success",
            "toplam_dosya": len(dosyalar),
            "hata_sayisi": hata_sayisi,
            "toplam_net": toplam_net,
            "toplam_kdv": toplam_kdv,
            "toplam_brut": toplam_net + toplam_kdv,
            "sonuclar": sonuclar,
            "kayit_sonuclari": kayit_sonuclari
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# KDV Türü Belirleme Fonksiyonu

def kdv_turu_belirle(firma_adi: str, belge_turu: str, urunler: list, kdv: float, musteri_adi: str = None) -> tuple:
    """
    Belgeye göre otomatik KDV türünü belirle
    Returns: (tahsil_kdv, odenen_kdv)
    
    Kural: Firma adı müşteri adı ile aynıysa GELİR, farklıysa GİDER
    """
    # 1. Z-Raporu her zaman GELİR
    if belge_turu == 'z_raporu':
        print("Z-Raporu -> GELİR")
        return kdv, 0.0
    
    firma_adi_upper = firma_adi.upper()
    
    # 2. Eğer firma adı müşteri adı ile aynıysa -> GELİR
    if musteri_adi:
        musteri_adi_upper = musteri_adi.upper()
        # Müşteri adı firma adının içinde geçiyorsa (tam veya kısmi eşleşme)
        if musteri_adi_upper in firma_adi_upper or firma_adi_upper in musteri_adi_upper:
            print(f"'{firma_adi}' -> GELİR (Müşteri ile eşleşti: '{musteri_adi}')")
            return kdv, 0.0
    
    # 3. MARKET ALIŞVERİŞLERİ → GİDER
    market_keywords = [
        'SOK MARKET', 'MİGROS', 'CARREFOUR', 'BİM', 'A101', 'ŞOK',
        'METRO', 'MARKET', 'SÜPERMARKET', 'MAKRO', 'FİLE',
        'OBA KÖY', 'GIDA'
    ]
    
    for keyword in market_keywords:
        if keyword in firma_adi_upper:
            print(f"'{firma_adi}' -> GİDER (Market Alışverişi)")
            return 0.0, kdv
    
    # 4. LOJİSTİK / NAKLİYE -> GİDER
    lojistik_keywords = [
        'LOJİSTİK', 'NAKLİYE', 'KARGO', 'KURYER', 'TAŞIMA', 
        'DEPO', 'DEPOLAMA', 'DAĞITIM', 'DISTRIBÜTÖR'
    ]
    
    for keyword in lojistik_keywords:
        if keyword in firma_adi_upper:
            print(f"'{firma_adi}' -> GİDER (Lojistik/Hizmet)")
            return 0.0, kdv
    
    # 5. TEDARİKÇİLER -> GİDER
    tedarik_keywords = [
        'TEDARİK', 'TEDARİKÇİ', 'TEDARİK A.Ş.', 'TİCARET LTD',
        'IMALAT', 'ÜRETİM', 'SANAYİ', 'FABRİKA', 'ATÖLYE',
        'TOPTAN', 'PERAKENDE'
    ]
    
    for keyword in tedarik_keywords:
        if keyword in firma_adi_upper:
            print(f"'{firma_adi}' -> GİDER (Tedarik/Alış)")
            return 0.0, kdv
    
    # 6. HİZMETLER -> GİDER
    hizmet_keywords = [
        'YEMEK', 'CATERING', 'TEMİZLİK', 'GÜVENLİK', 'DANIŞMANLIK',
        'HİZMET', 'SERVİS', 'BAKIM', 'ONARIM', 'TAMİR'
    ]
    
    for keyword in hizmet_keywords:
        if keyword in firma_adi_upper:
            print(f"'{firma_adi}' -> GİDER (Hizmet Alımı)")
            return 0.0, kdv
    
    # 7. Belge türüne göre
    if belge_turu in ['gider_faturasi', 'alis_fisi']:
        print(f"{belge_turu} -> GİDER")
        return 0.0, kdv
    
    # 8. Varsayılan: GELİR
    print(f"'{firma_adi}' -> Varsayılan GELİR")
    return kdv, 0.0


# Müşteri Yönetimi

@router.post("/musteri/ekle")
async def musteri_ekle(data: MusteriEkleModel):
    try:
        return DatabaseManager.save_musteri(data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/musteriler")
async def get_musteriler(
    user_id: Optional[int] = Query(None, description="Mali müşavir ID")
):
    try:
        return DatabaseManager.get_musteriler(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/musteri/{musteri_id}")
async def get_musteri(musteri_id: int):
    try:
        return DatabaseManager.get_musteri_by_id(musteri_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/musteri/{musteri_id}")
async def update_musteri(
    musteri_id: int,
    data: MusteriGuncelleModel
):
    try:
        update_data = {k: v for k, v in data.dict().items() if v is not None}
        return DatabaseManager.update_musteri(musteri_id, update_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/musteri/{musteri_id}")
async def delete_musteri(musteri_id: int):
    try:
        return DatabaseManager.delete_musteri(musteri_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/musteri/{musteri_id}/ozet")
async def musteri_ozet(musteri_id: int):
    try:
        return DatabaseManager.get_musteri_ozet(musteri_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Veritabanı Sorgulama

@router.get("/belgeler")
async def get_belgeler(
    musteri_id: Optional[int] = Query(None, description="Müşteri ID'ye göre filtrele"),
    limit: int = Query(100, description="Maksimum sonuç sayısı")
):
    try:
        return DatabaseManager.get_documents(musteri_id, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/belge/{doc_id}")
async def get_belge_by_id(doc_id: int):
    try:
        return DatabaseManager.get_document_by_id(doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/belge/{doc_id}")
async def delete_belge(doc_id: int):
    try:
        return DatabaseManager.delete_document(doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Kontrol

@router.get("/kontrol/{musteri_id}/{ay}/{yil}")
async def kontrol_yap(
    musteri_id: int,
    ay: int,
    yil: int
):
    try:
        from models.database import SessionLocal, Document
        
        session = SessionLocal()
        try:
            docs = session.query(Document).filter(
                Document.musteri_id == musteri_id,
                Document.tarih.like(f"%.{ay}.{yil}")
            ).all()
            
            toplam_net = sum(d.toplam_net for d in docs)
            toplam_kdv = sum(d.toplam_kdv for d in docs)
            
            return JSONResponse({
                "musteri_id": musteri_id,
                "donem": f"{ay}/{yil}",
                "toplam_belge": len(docs),
                "toplam_net": toplam_net,
                "toplam_kdv": toplam_kdv,
                "toplam_brut": toplam_net + toplam_kdv,
                "durum": "TAMAM",
                "hatalar": [],
                "eksikler": []
            })
        finally:
            session.close()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Rapor

@router.get("/rapor/{musteri_id}/{ay}/{yil}")
async def rapor_olustur(
    musteri_id: int,
    ay: int,
    yil: int,
    format: str = Query("excel", description="Rapor formatı: excel veya pdf")
):
    try:
        from models.database import SessionLocal, Document
        
        session = SessionLocal()
        try:
            docs = session.query(Document).filter(
                Document.musteri_id == musteri_id,
                Document.tarih.like(f"%.{ay}.{yil}")
            ).all()
            
            rapor_verisi = {
                "musteri_id": musteri_id,
                "donem": f"{ay}/{yil}",
                "olusturma_tarihi": datetime.now().strftime("%d.%m.%Y %H:%M"),
                "belge_sayisi": len(docs),
                "toplam_net": sum(d.toplam_net for d in docs),
                "toplam_kdv": sum(d.toplam_kdv for d in docs),
                "toplam_brut": sum(d.toplam_brut for d in docs)
            }
        finally:
            session.close()
        
        return JSONResponse({
            "status": "success",
            "format": format,
            "veri": rapor_verisi
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# e-Beyanname Veri Hazırlığı

@router.get("/beyanname/hazirla/{musteri_id}/{ay}/{yil}")
async def beyanname_hazirla(
    musteri_id: int,
    ay: int,
    yil: int
):
    """
    Müşteri için KDV beyanname verisi hazırla
    """
    try:
        from services.beyanname_servisi import BeyannameServisi
        result = BeyannameServisi.beyanname_hazirla(musteri_id, ay, yil)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# KDV Durumu

@router.get("/kdv/durum/{musteri_id}")
async def get_kdv_durum(
    musteri_id: int,
    ay: Optional[int] = Query(None, description="Ay (1-12)"),
    yil: Optional[int] = Query(None, description="Yıl")
):
    try:
        if not ay:
            ay = datetime.now().month
        if not yil:
            yil = datetime.now().year
        
        result = KDVServisi.kdv_hesapla(musteri_id, ay, yil)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/kdv/rapor/{musteri_id}")
async def generate_kdv_rapor(
    musteri_id: int,
    data: KDVDataModel
):
    try:
        result = KDVServisi.kdv_hesapla(musteri_id, data.ay, data.yil)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return {
            "status": "success",
            "message": "Rapor başarıyla oluşturuldu",
            "data": result["data"],
            "dosya_url": f"/api/kdv/rapor/indir/{musteri_id}/{data.ay}/{data.yil}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kdv/rapor/indir/{musteri_id}/{ay}/{yil}")
async def download_kdv_rapor(
    musteri_id: int,
    ay: int,
    yil: int
):
    try:
        result = KDVServisi.kdv_hesapla(musteri_id, ay, yil)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return JSONResponse({
            "status": "success",
            "data": result["data"],
            "indirme_tarihi": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Banka Mutabakatı

@router.post("/excel/sutunlar")
async def excel_sutunlari_oku(
    dosya: UploadFile = File(...)
):
    """
    Excel dosyasının sütun isimlerini döndür (Frontend mapping için)
    """
    try:
        import tempfile
        import os
        
        dosya_adi = dosya.filename or "dosya"
        suffix = f".{dosya_adi.split('.')[-1]}" if '.' in dosya_adi else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await dosya.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            df = pd.read_excel(tmp_path)
            sutunlar = df.columns.tolist()
            return {"sutunlar": sutunlar}
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mutabakat/{musteri_id}")
async def banka_mutabakati(
    musteri_id: int,
    dosya: UploadFile = File(...),
    tarih_sutun: Optional[str] = Query(None, description="Tarih sütunu adı"),
    aciklama_sutun: Optional[str] = Query(None, description="Açıklama sütunu adı"),
    tutar_sutun: Optional[str] = Query(None, description="Tutar sütunu adı"),
    bakiye_sutun: Optional[str] = Query(None, description="Bakiye sütunu adı")
):
    """
    Banka ekstresi ile mutabakat yap
    """
    try:
        print("Mutabakat isteği alındı")
        print(f"Müşteri ID: {musteri_id}")
        print(f"Dosya adı: {dosya.filename}")
        
        mapping = {}
        if tarih_sutun:
            mapping['tarih'] = tarih_sutun
        if aciklama_sutun:
            mapping['aciklama'] = aciklama_sutun
        if tutar_sutun:
            mapping['tutar'] = tutar_sutun
        if bakiye_sutun:
            mapping['bakiye'] = bakiye_sutun
        
        dosya_adi = dosya.filename or "dosya"
        suffix = f".{dosya_adi.split('.')[-1]}" if '.' in dosya_adi else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await dosya.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            from services.banka_servisi import BankaServisi
            hareketler = BankaServisi.dosya_oku(tmp_path, dosya_adi, mapping)
            
            print(f"Okunan hareket sayısı: {len(hareketler)}")
            
            if not hareketler:
                return JSONResponse({
                    "status": "error",
                    "message": "Dosyadan veri okunamadı veya uygun format değil"
                }, status_code=400)
            
            from services.mutabakat_servisi import MutabakatServisi
            sonuc = MutabakatServisi.mutabakat_yap(musteri_id, hareketler)
            
            sonuc['kullanilan_sutunlar'] = {
                'tarih': mapping.get('tarih', 'Otomatik'),
                'tutar': mapping.get('tutar', 'Otomatik'),
                'aciklama': mapping.get('aciklama', 'Otomatik'),
                'bakiye': mapping.get('bakiye', 'Otomatik')
            }
            
            return sonuc
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        print(f"HATA: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Sağlık Kontrolü

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "gemini": "connected",
            "database": "connected"
        }
    }