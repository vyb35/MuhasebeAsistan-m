-- Kullanıcılar (Mali Müşavirler)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    sifre VARCHAR(255),
    ad_soyad VARCHAR(255),
    unvan VARCHAR(100),
    ofis_adi VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Müşteriler (İşletmeler)
CREATE TABLE musteriler (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    adi VARCHAR(255),
    vergi_no VARCHAR(10),
    adres TEXT,
    telefon VARCHAR(20),
    sektor VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Belgeler (Fiş, Fatura, Z-Raporu)
CREATE TABLE belgeler (
    id UUID PRIMARY KEY,
    musteri_id UUID REFERENCES musteriler(id),
    belge_turu VARCHAR(50), -- 'fis', 'fatura', 'z_raporu'
    tarih DATE,
    seri_no VARCHAR(50),
    firma_adi VARCHAR(255),
    vergi_no VARCHAR(10),
    net_tutar DECIMAL(10,2),
    kdv_tutari DECIMAL(10,2),
    brut_tutar DECIMAL(10,2),
    kdv_orani INTEGER, -- 1, 10, 20
    vergi_kodu VARCHAR(10), -- 0015, 0073 vb.
    ham_json JSONB,
    durum VARCHAR(20), -- 'isleniyor', 'tamam', 'hata'
    kontrol_sonucu JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ürün Grupları (KDV eşleştirme)
CREATE TABLE urun_gruplari (
    id UUID PRIMARY KEY,
    grup_adi VARCHAR(100),
    gtip_kodu VARCHAR(12),
    kdv_orani INTEGER,
    vergi_kodu VARCHAR(10),
    gecerli_baslangic DATE,
    gecerli_bitis DATE
);

-- Ay Sonu Beyanname Verileri
CREATE TABLE beyanname_verileri (
    id UUID PRIMARY KEY,
    musteri_id UUID REFERENCES musteriler(id),
    ay INTEGER,
    yil INTEGER,
    gelir_kdv DECIMAL(10,2),
    gider_kdv DECIMAL(10,2),
    odenecek_kdv DECIMAL(10,2),
    durum VARCHAR(20), -- 'hazirlaniyor', 'hazir', 'gonderildi'
    eksik_belgeler JSONB,
    hatalar JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- İşlem Logları
CREATE TABLE islem_loglari (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    islem_turu VARCHAR(50),
    detay JSONB,
    ip_adresi VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);