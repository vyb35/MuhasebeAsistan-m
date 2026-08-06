# MuhasebeAI

Yapay zeka destekli, mali müşavirler ve KOBİ'ler için geliştirilmiş modern bir muhasebe asistanı. Belge yönetimi, KDV beyannamesi hazırlama, gider-gelir takibi ve banka mutabakatı süreçlerini otomatikleştirir.

---

## Proje Hakkında

MuhasebeAI, muhasebe işlemlerini hızlandırmak ve manuel veri girişinden kaynaklanan hataları en aza indirmek amacıyla geliştirilmiştir. Kullanıcılar, fiş, fatura ve Z-raporu görsellerini yükleyerek belgelerin otomatik olarak okunmasını ve veritabanına kaydedilmesini sağlayabilir. Sistem ayrıca, müşteri bazında KDV matrahlarını hesaplayarak beyanname verilerini JSON formatında dışa aktarır.

---

## Kullanılan Teknolojiler

- Backend: Python, FastAPI, PostgreSQL, SQLAlchemy
- Yapay Zeka: Google Gemini (OCR ve belge anlama)
- Frontend: React, TypeScript, Tailwind CSS, Recharts
- Veri İşleme: Pandas, NumPy
- Deployment: Uvicorn, Docker

---

## Öne Çıkan Özellikler

### Belge Yönetimi

Kullanıcılar, fiş, fatura ve Z-raporu görsellerini tekli veya toplu olarak sisteme yükleyebilir. Google Gemini modeli, yüklenen belgeleri okuyarak firma adı, vergi numarası, tarih ve ürün bilgilerini çıkarır. KDV oranları ürün bazında tespit edilir ve belge otomatik olarak veritabanına kaydedilir.

### KDV Beyanname Hazırlama

Sistem, müşteri bazında aylık KDV matrahını, tahsil edilen ve ödenen KDV tutarlarını hesaplar. Net KDV pozitif ise ödenecek, negatif ise iade alınacak olarak işaretlenir. Hesaplanan veriler JSON formatında dışa aktarılabilir.

### Müşteri ve Belge Takibi

Müşteri ekleme, silme ve güncelleme işlemleri yapılabilir. Her müşteri için yüklenen belgeler listelenir ve toplam net, KDV ve brüt tutarlar görüntülenir.

### Banka Mutabakatı

Excel veya CSV formatındaki banka ekstreleri sisteme yüklenerek, mevcut hareketlerle eşleştirme yapılabilir. Bu sayede banka hesap hareketleri ile muhasebe kayıtları karşılaştırılabilir.

### Raporlama

KDV durumu, matrah dağılımı ve aylık gelir-gider grafikleri ile kullanıcılara kapsamlı bir finansal özet sunulur.

---

## Proje Yapısı
