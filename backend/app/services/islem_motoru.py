# services/islem_motoru.py
import json
from pathlib import Path

class IslemMotoru:
    def __init__(self):
        self.urun_gruplari = self._load_urun_gruplari()
    
    def _load_urun_gruplari(self):
        """Ürün gruplarını JSON'dan yükle"""
        try:
            config_path = Path(__file__).parent.parent.parent / "config" / "urun_gruplari.json"
            if config_path.exists():
                with open(config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                urun_map = {}
                for grup, detay in data.get('urun_gruplari', {}).items():
                    kdv_orani = detay.get('kdv_orani', 20)
                    vergi_kodu = detay.get('vergi_kodu', '0015')
                    
                    urun_map[grup.upper()] = {
                        'kdv_orani': kdv_orani,
                        'vergi_kodu': vergi_kodu
                    }
                    
                    for kelime in detay.get('anahtar_kelimeler', []):
                        urun_map[kelime.upper()] = {
                            'kdv_orani': kdv_orani,
                            'vergi_kodu': vergi_kodu
                        }
                return urun_map
        except Exception as e:
            print(f"⚠️ Ürün grupları yüklenirken hata: {e}")
        return {}
    
    def isle(self, ham_veri):
        """
        Ham veriyi işle - AKILLI KDV YÖNETİMİ!
        1. EĞER FİŞTE KDV VARSA → DOĞRUDAN KULLAN!
        2. FİŞTE KDV YOKSA → HESAPLA!
        3. BRÜT ise NET'e çevir
        """
        veri = self._kdv_yonet(ham_veri)
        return self._formatla(veri)
    
    def _kdv_yonet(self, veri):
        """
        KDV oranlarını akıllıca yönet:
        1. EĞER FİŞTE KDV VARSA → DOĞRUDAN KULLAN (yuvarlama farkını kapat!)
        2. FİŞTE KDV YOKSA → HESAPLA!
           - Önce Gemini'den gelen oranı kontrol et (kdv_orani > 0 ise KULLAN)
           - Gemini oran vermemişse (0 veya null) JSON'dan BUL
           - Hiçbiri yoksa %20 VARSay
        3. ara_toplam_tipi 'brut' ise NET'e çevir
        """
        
        urunler = veri.get('urunler', [])
        genel_kdv_orani = veri.get('kdv_orani', 0)
        ara_toplam_tipi = veri.get('ara_toplam_tipi', 'net')
        fiş_kdv = veri.get('kdv', 0)
        
        print(f"ara_toplam_tipi: {ara_toplam_tipi}")
        print(f"Fişteki KDV: {fiş_kdv}")
        
        # 1. Fişte KDV varsa doğrudan kullan
        if fiş_kdv and fiş_kdv > 0:
            print(f"Fişteki KDV kullanılıyor: {fiş_kdv}")
            
            # KDV'yi doğrudan kullan
            veri['kdv'] = round(fiş_kdv, 2)
            
            # Toplam Net ve Brüt'ü güncelle
            toplam_net = sum(u.get('tutar', 0) for u in urunler)
            
            # Eğer genel_toplam varsa ve ara_toplam varsa
            if veri.get('genel_toplam', 0) > 0 and veri.get('ara_toplam', 0) > 0:
                # Brüt sabit, Net = Brüt - KDV
                veri['ara_toplam'] = round(veri['genel_toplam'] - veri['kdv'], 2)
                print(f"   Brüt ({veri['genel_toplam']}) - KDV ({veri['kdv']}) = Net ({veri['ara_toplam']})")
            elif veri.get('genel_toplam', 0) > 0:
                # Sadece Brüt var
                veri['ara_toplam'] = round(veri['genel_toplam'] - veri['kdv'], 2)
            else:
                # Net sabit, Brüt = Net + KDV
                veri['genel_toplam'] = round(toplam_net + veri['kdv'], 2)
            
            print(f"Fiş KDV kullanıldı: Net: {veri['ara_toplam']}, KDV: {veri['kdv']}, Brüt: {veri['genel_toplam']}")
            return veri
        
        # 2. Fişte KDV yoksa hesapla
        print("Fişte KDV bulunamadı, hesaplanıyor...")
        
        for urun in urunler:
            # 2.1. Önce ürün bazında Gemini'den gelen KDV oranını kontrol et
            gemini_orani = urun.get('kdv_orani', 0)
            brut_tutar = urun.get('tutar', 0)
            
            # 2.2. KDV oranını belirle
            if gemini_orani and gemini_orani > 0:
                kdv_orani = gemini_orani
                print(f"Gemini'den alınan (ürün bazında) KDV oranı: %{kdv_orani}")
            elif genel_kdv_orani and genel_kdv_orani > 0:
                kdv_orani = genel_kdv_orani
                print(f"Gemini'den alınan (genel) KDV oranı: %{kdv_orani}")
            else:
                urun_grubu = str(urun.get('grup', 'DIGER')).upper()
                bulunan = self.urun_gruplari.get(urun_grubu)
                
                if bulunan is None:
                    for anahtar, deger in self.urun_gruplari.items():
                        if anahtar in urun_grubu or urun_grubu in anahtar:
                            bulunan = deger
                            break
                
                if bulunan is None:
                    bulunan = {'kdv_orani': 20, 'vergi_kodu': '0015'}
                
                kdv_orani = bulunan['kdv_orani']
                urun['vergi_kodu'] = bulunan['vergi_kodu']
                print(f"JSON'dan bulunan KDV oranı: %{kdv_orani}")
            
            urun['kdv_orani'] = kdv_orani
            
            # 2.3. BRÜT ise NET'e çevir
            if ara_toplam_tipi == 'brut' and kdv_orani > 0:
                net_tutar = brut_tutar / (1 + kdv_orani / 100)
                urun['tutar'] = round(net_tutar, 2)
                urun['kdv_tutari'] = round(brut_tutar - net_tutar, 2)
                print(f"   BRÜT->NET: {brut_tutar} -> {urun['tutar']}, KDV: {urun['kdv_tutari']}")
            else:
                # NET ise doğrudan KDV hesapla
                urun['kdv_tutari'] = round(brut_tutar * (kdv_orani / 100), 2)
                print(f"   NET: {brut_tutar} × %{kdv_orani} = {urun['kdv_tutari']}")
        
        # Toplam KDV'yi yeniden hesapla (ürün bazında topla)
        toplam_kdv = sum(u.get('kdv_tutari', 0) for u in urunler)
        veri['kdv'] = round(toplam_kdv, 2)
        
        # Toplam Net'i yeniden hesapla (ürün bazında topla)
        toplam_net = sum(u.get('tutar', 0) for u in urunler)
        veri['ara_toplam'] = round(toplam_net, 2)
        veri['genel_toplam'] = round(toplam_net + toplam_kdv, 2)
        
        print(f"Toplam Net: {veri['ara_toplam']}, Toplam KDV: {veri['kdv']}, Toplam Brüt: {veri['genel_toplam']}")
        
        return veri
    
    def _formatla(self, veri):
        """Frontend ve Veritabanı için standart formatlama"""
        return {
            'belge_turu': veri.get('belge_turu', 'fis'),
            'tarih': veri.get('tarih', ''),
            'firma_adi': veri.get('firma_adi', ''),
            'vergi_no': veri.get('vergi_no', ''),
            'urunler': veri.get('urunler', []),
            'toplam_net': round(veri.get('ara_toplam', 0), 2),
            'toplam_kdv': round(veri.get('kdv', 0), 2),
            'toplam_brut': round(veri.get('genel_toplam', 0), 2),
            'belgedeki_vergi': round(veri.get('kdv', 0), 2),
            'tahsil_kdv': round(veri.get('tahsil_kdv', 0), 2),
            'odenen_kdv': round(veri.get('odenen_kdv', 0), 2),
            'iskonto': round(veri.get('iskonto', 0), 2),
            'kdv_tablosu_bulundu': veri.get('kdv_tablosu_bulundu', False),
            'hatalar': [],
            'islem_tarihi': veri.get('islem_tarihi', '')
        }


def isle(ham_veri):
    motor = IslemMotoru()
    return motor.isle(ham_veri)