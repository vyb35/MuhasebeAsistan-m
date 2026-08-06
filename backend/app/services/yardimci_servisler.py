# services/yardimci_servisler.py
import json
import requests
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

class YardimciServisler:
    """API'den veri çeken yardımcı servisler"""
    
    # --- 1. TATİL TAKVİMİ (Nager.Date API - Ücretsiz) ---
    @staticmethod
    def get_tatiller(yil: int = None) -> List[Dict]:
        """Türkiye resmi tatillerini API'den çek"""
        if yil is None:
            yil = datetime.now().year
        
        try:
            url = f"https://date.nager.at/api/v3/PublicHolidays/{yil}/TR"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                tatiller = response.json()
                # Sadece tarih listesi döndür (kolay kontrol için)
                return [t['date'] for t in tatiller]
            else:
                print(f"Tatil API hatası (HTTP {response.status_code}), yerel dosyaya bakılıyor...")
                return YardimciServisler._tatilleri_yedekten_al(yil)
        except Exception as e:
            print(f"Tatil API bağlantı hatası: {e}, yerel dosyaya bakılıyor...")
            return YardimciServisler._tatilleri_yedekten_al(yil)
    
    @staticmethod
    def _tatilleri_yedekten_al(yil: int) -> List[str]:
        """API çalışmazsa config/tatil_takvimi.json'dan oku"""
        try:
            config_path = Path(__file__).parent.parent.parent / "config" / "tatil_takvimi.json"
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                yil_str = str(yil)
                if yil_str in data:
                    # JSON'daki tarihleri "YYYY-MM-DD" formatında listele
                    tatil_gunleri = []
                    for ay, gunler in data[yil_str].items():
                        for gun in gunler:
                            tatil_gunleri.append(f"{yil}-{ay}-{gun}")
                    return tatil_gunleri
        except:
            pass
        return []  # Hiçbir veri yoksa tatil yokmuş gibi davran
    
    @staticmethod
    def is_tatil(tarih: str = None) -> bool:
        """Verilen tarih (veya bugün) tatil mi?"""
        if tarih is None:
            tarih = datetime.now().strftime("%Y-%m-%d")
        
        yil = int(tarih[:4])
        tatiller = YardimciServisler.get_tatiller(yil)
        return tarih in tatiller
    
    @staticmethod
    def get_beyanname_son_gun(ay: int = None, yil: int = None) -> str:
        """Beyanname son gününü hesapla (tatil varsa ötele)"""
        if yil is None or ay is None:
            now = datetime.now()
            yil = now.year
            ay = now.month
        
        # Normalde 26'sı
        son_gun = datetime(yil, ay, 26)
        
        # Tatil veya hafta sonu mu kontrol et
        tatiller = YardimciServisler.get_tatiller(yil)
        
        while True:
            tarih_str = son_gun.strftime("%Y-%m-%d")
            if tarih_str in tatiller or son_gun.weekday() >= 5:  # 5=Cumartesi, 6=Pazar
                son_gun += timedelta(days=1)
            else:
                break
        
        return son_gun.strftime("%d.%m.%Y")
    
    # --- 2. DÖVİZ KURU (TCMB veya Ücretsiz API) ---
    @staticmethod
    def get_doviz_kuru(birim: str = "USD") -> float:
        """Döviz kurunu çek (USD, EUR)"""
        try:
            # exchangerate-api.com (ücretsiz, anahtar gerekmez)
            url = f"https://api.exchangerate-api.com/v4/latest/TRY"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if birim == "USD":
                    return 1 / data['rates']['USD']  # 1 USD kaç TL
                elif birim == "EUR":
                    return 1 / data['rates']['EUR']  # 1 EUR kaç TL
            return 1.0  # Hata durumunda 1.0 döndür
        except:
            return 1.0  # Hata durumunda 1.0 döndür
    
    # --- 3. CONFIG YÜKLEME (API'den çekilen verilerle birleştir) ---
    @staticmethod
    def load_config(filename: str) -> Dict[str, Any]:
        """Config dosyasını yükle (yerel)"""
        config_path = Path(__file__).parent.parent.parent / "config" / filename
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    @staticmethod
    def tarih_formatla(tarih) -> str:
        """Tarihi formatla"""
        if not tarih:
            return ""
        if isinstance(tarih, str):
            try:
                return datetime.strptime(tarih, '%Y-%m-%d').strftime('%d.%m.%Y')
            except:
                return tarih
        if isinstance(tarih, datetime):
            return tarih.strftime('%d.%m.%Y')
        return str(tarih)
    
    @staticmethod
    def para_formatla(tutar) -> str:
        """Parayı formatla (TL)"""
        try:
            return f"{float(tutar):.2f} TL"
        except:
            return f"{tutar} TL"


# --- FONKSİYON VERSİYONLARI (services/__init__.py'de import için) ---
def get_tatiller(yil: int = None) -> List[str]:
    return YardimciServisler.get_tatiller(yil)

def is_tatil(tarih: str = None) -> bool:
    return YardimciServisler.is_tatil(tarih)

def get_beyanname_son_gun(ay: int = None, yil: int = None) -> str:
    return YardimciServisler.get_beyanname_son_gun(ay, yil)

def get_doviz_kuru(birim: str = "USD") -> float:
    return YardimciServisler.get_doviz_kuru(birim)

def load_config(filename: str) -> Dict[str, Any]:
    return YardimciServisler.load_config(filename)

def tarih_formatla(tarih) -> str:
    return YardimciServisler.tarih_formatla(tarih)

def para_formatla(tutar) -> str:
    return YardimciServisler.para_formatla(tutar)