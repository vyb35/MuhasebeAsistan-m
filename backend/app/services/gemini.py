# services/gemini.py
import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# API Key check
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("❌ GEMINI_API_KEY bulunamadı!")
    exit(1)

client = genai.Client(api_key=api_key)


def detect_mime_type(data: bytes) -> str:
    """Görsel / Belge tipini başlık imzasına göre otomatik algıla"""
    if data.startswith(b'%PDF'):
        return "application/pdf"
    elif data.startswith(b'\x89PNG\r\n\x1a\n'):
        return "image/png"
    elif data.startswith(b'RIFF') and b'WEBP' in data[:16]:
        return "image/webp"
    else:
        return "image/jpeg"


def get_available_models():
    """Müsait ve multimodal (görsel okuyabilen) modelleri, öncelik sırasına göre döndürür.
    En hızlı/en güncel modeller önce denenir, kota dolan/müsait olmayan modeller otomatik elenir."""

    # 📌 Öncelik sırası: en hızlı ve en güncel modeller önce denenir.
    priority_order = [
        "gemini-flash-latest",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-8b",
    ]

    try:
        all_models = client.models.list()
        discovered_models = []
        for model in all_models:
            # Sadece "generateContent" destekleyen ve "gemini" içeren modelleri al
            actions = getattr(model, "supported_actions", None) or []
            if 'generateContent' in actions and 'gemini' in model.name:
                # Bazı modeller sadece metin içindir, görsel desteklemez. Onları eliyoruz.
                if 'flash' in model.name or 'pro' in model.name:
                    discovered_models.append(model.name)

        if not discovered_models:
            raise ValueError("API'den hiç model dönmedi")

        # Öncelik listesindeki modelleri, keşfedilen modeller içinde varsa sırayla ekle
        sorted_models = []
        for preferred in priority_order:
            for discovered in discovered_models:
                if preferred in discovered and discovered not in sorted_models:
                    sorted_models.append(discovered)

        # Öncelik listesinde olmayan ama API'de bulunan diğer modelleri sona ekle
        for discovered in discovered_models:
            if discovered not in sorted_models:
                sorted_models.append(discovered)

        return sorted_models

    except Exception as e:
        print(f"❌ Modeller listelenirken hata: {e}")
        # Eğer liste alınamazsa, öncelik sırasına göre varsayılan modelleri dene
        return priority_order


# 📌 Prompt ayrı bir sabit olarak tanımlandı
PROMPT_TEMPLATE = """Sen uzman bir Türk Muhasebe ve Belge Analiz Yapay Zekasısın. Sana gönderilen fiş, fatura veya Z-Raporu görselini/PDF'sini DİKKATLE OKU ve aşağıdaki kurallara göre JSON çıktısı ver.

═══════════════════════════════════════
ADIM 1: BELGE TÜRÜNÜ BELİRLE
═══════════════════════════════════════
- "FİŞ", "FATURA NO" yoksa, "ÖKC", "YAZAR KASA FİŞİ" → belge_turu = "fis"
- "FATURA", "e-Fatura", "e-Arşiv Fatura", fatura numarası varsa → belge_turu = "fatura"
- "Z RAPORU", "MALİ Z" varsa → belge_turu = "z_raporu"

═══════════════════════════════════════
ADIM 2: KDV KIRILIM TABLOSU VAR MI KONTROL ET
═══════════════════════════════════════
Fişin/faturanın altında genelde şuna benzer bir tablo bulunur:
  KDV%      MATRAH      KDV TUTAR
  %1        74.26       0.74
  %10       ...         ...
  %20       ...         ...

EĞER TABLO VARSA:
- kdv_tablosu_bulundu = true
- MATRAH değerini NET olarak DOĞRUDAN OKU (hesaplama YAPMA)
- KDV TUTAR değerini KDV olarak DOĞRUDAN OKU (hesaplama YAPMA)
- ara_toplam_tipi = "net"
- Bu tablo en güvenilir kaynaktır, tahmin etme, sadece oku.

EĞER TABLO YOKSA:
- kdv_tablosu_bulundu = false
- ADIM 3'e geç.

═══════════════════════════════════════
ADIM 3: NET/BRÜT AYRIMI (belge_turu'na göre DEĞİŞİR!)
═══════════════════════════════════════

FİŞ (perakende / ÖKC) için — KDV kırılım tablosu YOKSA:
- Perakende fişlerde ürün fiyatları genelde KDV DAHİL (BRÜT) yazılır.
- "ARA TOPLAM" = ürünlerin BRÜT toplamı (iskontodan önce)
- "TOPLAM" / "GENEL TOPLAM" = ARA TOPLAM − İSKONTO (bu da hâlâ BRÜT'tür!)
- Bu durumda ara_toplam_tipi = "brut"
- NET = BRÜT / (1 + KDV_ORANI/100)
- KDV = BRÜT − NET

FATURA için (KDV kırılım tablosu yoksa):
- "Ara Toplam" veya "Matrah" = NET
- ara_toplam_tipi = "net"
- KDV ayrı bir satırda yazılıdır, DOĞRUDAN OKU
- "Genel Toplam" / "Ödenecek Tutar" = NET + KDV = BRÜT

Z-RAPORU için:
- Raporda oran bazında (%1, %10, %20) ayrı ayrı MATRAH (net) ve KDV TUTARI satırları basılıdır.
- kdv_tablosu_bulundu = true
- ara_toplam_tipi = "net"
- Bu değerleri DOĞRUDAN OKU, hesaplama yapma.

═══════════════════════════════════════
ADIM 4: KDV ORANI BELİRLEME (SIRALI!)
═══════════════════════════════════════
1. ÖNCELİKLE FİŞTEKİ/FATURADAKİ KDV ORANINI OKU!
   - "%1 KDV", "KDV %1" → kdv_orani = 1
   - "%10 KDV", "KDV %10" → kdv_orani = 10
   - "%20 KDV", "KDV %20" → kdv_orani = 20
2. BELGEDE KDV ORANI YAZMIYORSA → kdv_orani = 0 YAZ!
   - ASLA KENDİN KDV ORANI TAHMİN ETME!
   - 0 olarak bırakılan değerler sistem tarafından urun_gruplari.json'a göre
     otomatik doldurulacaktır.
3. Fişte birden fazla KDV oranı varsa, her ürünü kendi oranına göre işaretle.
   Genel "kdv_orani" alanına, EĞER TEK ORAN VARSA o oranı, BİRDEN FAZLA
   ORAN VARSA 0 yaz.

═══════════════════════════════════════
ADIM 5: GRUP SINIFLANDIRMASI
═══════════════════════════════════════
- YIYECEK: restoran, yemek, kebap, meze, salata, çorba, pizza, burger, döner, lahmacun, pide
- ICEYECEK: su, kola, meyve suyu, ayran, soda, kahve, çay, limonata
- ALKOL: bira, rakı, şarap, votka, viski, kokteyl, likör
- GIDA: market alışverişi, süt, peynir, yoğurt, ekmek, makarna, pirinç, zeytinyağı, şeker, çay, meyve, sebze, et, tavuk, balık
- TEKSTIL: giyim, gömlek, pantolon, ayakkabı, çanta, mont, elbise, etek, kravat
- ELEKTRONIK: telefon, bilgisayar, tablet, televizyon, kulaklık, monitör, klavye
- HIZMET: danışmanlık, lojistik, pazarlama, taşımacılık, kurulum, eğitim, sağlık, temizlik, güvenlik
- KONAKLAMA: otel, motel, pansiyon, apart otel
- DIGER: yukarıdaki gruplara girmeyen tüm diğer harcamalar

═══════════════════════════════════════
ADIM 6: TUTAR DOĞRULAMA (SELF-CHECK)
═══════════════════════════════════════
JSON'u oluşturduktan sonra kendi kendine kontrol et:
- SUM(urunler[].tutar) ≈ ara_toplam (±0.05 tolerans)
- ara_toplam − iskonto + kdv ≈ genel_toplam (±0.05 tolerans)
- Eşleşmiyorsa değerleri tekrar gözden geçir.

═══════════════════════════════════════
GENEL KURALLAR
═══════════════════════════════════════
- KDV ORANINI ASLA TAHMİN ETME! Belgede yazıyorsa oku, yazmıyorsa 0 yaz.
- NET/BRÜT varsayımını asla belge türüne bakmadan yapma.
- KDV kırılım tablosu varsa her zaman ona öncelik ver.
- Sayısal değerlerde nokta/virgül OCR karışıklığına dikkat et.
- Emin olmadığın alanları boş bırakma; en olası değeri yaz ama uydurma rakam üretme.

═══════════════════════════════════════
ÇIKTI FORMATI (SADECE VE SADECE GEÇERLİ JSON!)
═══════════════════════════════════════
{
    "belge_turu": "fis",
    "tarih": "05.08.2026",
    "firma_adi": "OBA KÖY GIDA...",
    "vergi_no": "6320278519",
    "kdv_tablosu_bulundu": false,
    "urunler": [
        {
            "grup": "GIDA",
            "aciklama": "EKŞİ MAYALI TAM BUĞDA",
            "tutar": 74.26,
            "kdv_orani": 1
        }
    ],
    "ara_toplam": 74.26,
    "ara_toplam_tipi": "net",
    "iskonto": 0,
    "kdv": 0.74,
    "kdv_orani": 1,
    "genel_toplam": 75.00
}
"""


def gemini_oku(image_bytes: bytes, prompt_type="fis"):
    """Gemini ile belgeleri okur - Gerçekten müsait olan modeli otomatik seçer."""

    mime_type = detect_mime_type(image_bytes)
    print(f"Algılanan Belge Türü: {mime_type} ({len(image_bytes)} bayt)")

    contents = [
        PROMPT_TEMPLATE,
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    ]

    # Müsait modelleri al
    models_to_try = get_available_models()
    print(f"Test edilecek modeller: {models_to_try}")

    response = None
    last_error = None
    kota_dolu_modeller = []

    # 1. TUR: Tüm modelleri sırayla dene
    for model_name in models_to_try:
        try:
            print(f"Gemini {model_name} ile belge okunuyor...")
            response = client.models.generate_content(
                model=model_name,
                contents=contents
            )
            if response and response.text:
                print(f"✅ {model_name} belgeden başarıyla veri okudu!")
                break
        except Exception as e:
            error_str = str(e)
            print(f"⚠️ {model_name} denemesi başarısız: {e}")

            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                print(f"⏭️ {model_name} kotası dolu, sıradaki modele geçiliyor...")
                kota_dolu_modeller.append(model_name)

            last_error = e
            response = None

    # 🔁 2. TUR: Kota dolu modelleri tekrar dene
    if (not response or not response.text) and kota_dolu_modeller:
        print("⏳ 10 saniye beklenip kota dolu modeller tekrar deneniyor...")
        time.sleep(10)
        for model_name in kota_dolu_modeller:
            try:
                print(f"🤖 (2. deneme) Gemini {model_name} ile belge okunuyor...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents
                )
                if response and response.text:
                    print(f"✅ {model_name} belgeden başarıyla veri okudu!")
                    break
            except Exception as e:
                print(f"⚠️ {model_name} 2. denemesi de başarısız: {e}")
                last_error = e
                response = None

    if not response or not response.text:
        return {"error": f"Tüm modeller denendi, başarılı olmadı: {last_error}"}

    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(text)
        print("📄 Okunan Yapay Zeka Verisi:", json.dumps(parsed, ensure_ascii=False))
        return parsed
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse hatası: {e}")
        return {"error": "JSON parse edilemedi", "raw": text[:1000]}