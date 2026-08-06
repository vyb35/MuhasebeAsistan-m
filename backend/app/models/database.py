# backend/app/models/database.py
import os
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, Text, ForeignKey, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL / SQLite bağlantısı
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL bulunamadı, varsayılan SQLite kullanılıyor.")
    DATABASE_URL = "sqlite:///./muhasebe.db"

print(f"Veritabanı bağlantısı: {DATABASE_URL[:30]}...")

# Bağlantı motoru
engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base sınıf
Base = declarative_base()


# Müşteri Tablosu
class Musteri(Base):
    __tablename__ = "musteriler"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    adi = Column(String(255), nullable=False)
    vergi_no = Column(String(11), nullable=True)
    sektor = Column(String(50), nullable=True)
    telefon = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    adres = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # İlişki
    belgeler = relationship("Document", back_populates="musteri", cascade="all, delete-orphan")


# Belge Tablosu
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    belge_turu = Column(String(50))
    musteri_id = Column(Integer, ForeignKey("musteriler.id", ondelete="SET NULL"), nullable=True, index=True)
    tarih = Column(String(20))
    firma_adi = Column(String(255))
    vergi_no = Column(String(20))
    dosya_adi = Column(String(255))
    toplam_net = Column(Float, default=0)
    toplam_kdv = Column(Float, default=0)
    toplam_brut = Column(Float, default=0)
    belgedeki_vergi = Column(Float, default=0)
    
    # KDV Ayrımı Alanları
    tahsil_kdv = Column(Float, default=0)   # Satış KDV (Gelir)
    odenen_kdv = Column(Float, default=0)   # Alış KDV (Gider)
    
    iskonto = Column(Float, default=0)
    hatalar = Column(JSON, default=[])
    urunler = Column(JSON, default=[])
    ham_veri = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # İlişki
    musteri = relationship("Musteri", back_populates="belgeler")


# Tablo Oluşturma
def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        print("Veritabanı tabloları oluşturuldu.")
    except Exception as e:
        print(f"Tablo oluşturma hatası: {e}")

init_db()


# Veritabanı İşlemleri
class DatabaseManager:
    
    # Müşteri İşlemleri
    
    @staticmethod
    def save_musteri(data: dict):
        session = SessionLocal()
        try:
            musteri = Musteri(
                user_id=data.get('user_id'),
                adi=data.get('adi'),
                vergi_no=data.get('vergi_no'),
                sektor=data.get('sektor'),
                telefon=data.get('telefon'),
                email=data.get('email'),
                adres=data.get('adres')
            )
            session.add(musteri)
            session.commit()
            session.refresh(musteri)
            return {"status": "success", "id": musteri.id, "data": musteri}
        except Exception as e:
            session.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def get_musteriler(user_id: int = None):
        session = SessionLocal()
        try:
            query = session.query(Musteri)
            if user_id:
                query = query.filter(Musteri.user_id == user_id)
            musteriler = query.order_by(Musteri.adi.asc()).all()
            
            result = []
            for m in musteriler:
                # Müşteriye ait belgelerin özet bilgileri
                belgeler = session.query(Document).filter(Document.musteri_id == m.id).all()
                toplam_net = sum(d.toplam_net for d in belgeler)
                toplam_kdv = sum(d.toplam_kdv for d in belgeler)
                toplam_brut = sum(d.toplam_brut for d in belgeler)
                
                result.append({
                    "id": m.id,
                    "adi": m.adi,
                    "vergi_no": m.vergi_no,
                    "sektor": m.sektor,
                    "telefon": m.telefon,
                    "email": m.email,
                    "adres": m.adres,
                    "belge_sayisi": len(belgeler),
                    "toplam_net": toplam_net,
                    "toplam_kdv": toplam_kdv,
                    "toplam_brut": toplam_brut,
                    "created_at": m.created_at.isoformat() if m.created_at else None
                })
            return {"status": "success", "data": result}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def get_musteri_by_id(musteri_id: int):
        session = SessionLocal()
        try:
            musteri = session.query(Musteri).filter(Musteri.id == musteri_id).first()
            if not musteri:
                return {"status": "error", "message": "Müşteri bulunamadı"}
            
            return {
                "status": "success",
                "data": {
                    "id": musteri.id,
                    "adi": musteri.adi,
                    "vergi_no": musteri.vergi_no,
                    "sektor": musteri.sektor,
                    "telefon": musteri.telefon,
                    "email": musteri.email,
                    "adres": musteri.adres,
                    "created_at": musteri.created_at.isoformat() if musteri.created_at else None
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def update_musteri(musteri_id: int, data: dict):
        session = SessionLocal()
        try:
            musteri = session.query(Musteri).filter(Musteri.id == musteri_id).first()
            if not musteri:
                return {"status": "error", "message": "Müşteri bulunamadı"}
            
            for key, value in data.items():
                if hasattr(musteri, key) and value is not None:
                    setattr(musteri, key, value)
            
            musteri.updated_at = datetime.now()
            session.commit()
            session.refresh(musteri)
            return {"status": "success", "message": "Müşteri güncellendi", "data": musteri}
        except Exception as e:
            session.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def delete_musteri(musteri_id: int):
        session = SessionLocal()
        try:
            musteri = session.query(Musteri).filter(Musteri.id == musteri_id).first()
            if not musteri:
                return {"status": "error", "message": "Müşteri bulunamadı"}
            
            # Müşteriye ait belgeler otomatik silinecek (cascade)
            session.delete(musteri)
            session.commit()
            return {"status": "success", "message": "Müşteri silindi"}
        except Exception as e:
            session.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def get_musteri_ozet(musteri_id: int):
        session = SessionLocal()
        try:
            musteri = session.query(Musteri).filter(Musteri.id == musteri_id).first()
            if not musteri:
                return {"status": "error", "message": "Müşteri bulunamadı"}
            
            belgeler = session.query(Document).filter(Document.musteri_id == musteri_id).all()
            
            return {
                "status": "success",
                "data": {
                    "musteri_id": musteri_id,
                    "musteri_adi": musteri.adi,
                    "toplam_belge": len(belgeler),
                    "toplam_net": sum(d.toplam_net for d in belgeler),
                    "toplam_kdv": sum(d.toplam_kdv for d in belgeler),
                    "toplam_brut": sum(d.toplam_brut for d in belgeler),
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    # Belge İşlemleri
    
    @staticmethod
    def save_document(data: dict):
        session = SessionLocal()
        try:
            musteri_id = data.get('musteri_id')
            if musteri_id:
                try:
                    musteri_id = int(musteri_id)
                except (ValueError, TypeError):
                    musteri_id = None
            
            doc = Document(
                belge_turu=data.get('belge_turu', 'fis'),
                musteri_id=musteri_id,
                tarih=data.get('tarih', ''),
                firma_adi=data.get('firma_adi', ''),
                vergi_no=data.get('vergi_no', ''),
                dosya_adi=data.get('dosya_adi', ''),
                toplam_net=data.get('toplam_net', 0),
                toplam_kdv=data.get('toplam_kdv', 0),
                toplam_brut=data.get('toplam_brut', 0),
                belgedeki_vergi=data.get('belgedeki_vergi', 0),
                tahsil_kdv=data.get('tahsil_kdv', 0),
                odenen_kdv=data.get('odenen_kdv', 0),
                iskonto=data.get('iskonto', 0),
                hatalar=data.get('hatalar', []),
                urunler=data.get('urunler', []),
                ham_veri=data.get('_ham_veri', {})
            )
            session.add(doc)
            session.commit()
            session.refresh(doc)
            return {"status": "success", "id": doc.id, "message": "Belge kaydedildi"}
        except Exception as e:
            session.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def get_documents(musteri_id: int = None, limit: int = 100):
        session = SessionLocal()
        try:
            query = session.query(Document)
            if musteri_id:
                query = query.filter(Document.musteri_id == musteri_id)
            docs = query.order_by(Document.created_at.desc()).limit(limit).all()
            
            result = []
            for doc in docs:
                result.append({
                    "id": doc.id,
                    "belge_turu": doc.belge_turu,
                    "musteri_id": doc.musteri_id,
                    "tarih": doc.tarih,
                    "firma_adi": doc.firma_adi,
                    "toplam_net": doc.toplam_net,
                    "toplam_kdv": doc.toplam_kdv,
                    "toplam_brut": doc.toplam_brut,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None
                })
            return {"status": "success", "data": result}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def get_document_by_id(doc_id: int):
        session = SessionLocal()
        try:
            doc = session.query(Document).filter(Document.id == doc_id).first()
            if not doc:
                return {"status": "error", "message": "Belge bulunamadı"}
            
            return {
                "status": "success",
                "data": {
                    "id": doc.id,
                    "belge_turu": doc.belge_turu,
                    "musteri_id": doc.musteri_id,
                    "tarih": doc.tarih,
                    "firma_adi": doc.firma_adi,
                    "vergi_no": doc.vergi_no,
                    "dosya_adi": doc.dosya_adi,
                    "toplam_net": doc.toplam_net,
                    "toplam_kdv": doc.toplam_kdv,
                    "toplam_brut": doc.toplam_brut,
                    "belgedeki_vergi": doc.belgedeki_vergi,
                    "tahsil_kdv": doc.tahsil_kdv,
                    "odenen_kdv": doc.odenen_kdv,
                    "iskonto": doc.iskonto,
                    "hatalar": doc.hatalar,
                    "urunler": doc.urunler,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            session.close()
    
    @staticmethod
    def delete_document(doc_id: int):
        session = SessionLocal()
        try:
            doc = session.query(Document).filter(Document.id == doc_id).first()
            if not doc:
                return {"status": "error", "message": "Belge bulunamadı"}
            
            session.delete(doc)
            session.commit()
            return {"status": "success", "message": f"Belge {doc_id} silindi"}
        except Exception as e:
            session.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            session.close()