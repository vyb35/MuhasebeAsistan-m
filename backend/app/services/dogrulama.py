# services/dogrulama.py

class DogrulamaMotoru:
    def dogrula(self, veri):
        """Matematiksel ve mantıksal doğrulama"""
        sonuclar = {
            'matematiksel': self._matematiksel_kontrol(veri),
            'belge': self._belge_kontrol(veri),
            'mutabakat': self._mutabakat_kontrol(veri),
            'mevzuat': self._mevzuat_kontrol(veri)
        }
        
        hata_sayisi = sum(1 for s in sonuclar.values() if s)
        if hata_sayisi > 0:
            return {'durum': 'HATA_VAR', 'detay': sonuclar}
        return {'durum': 'TAMAM', 'detay': sonuclar}
    
    def _matematiksel_kontrol(self, veri):
        """Net + KDV = Brüt kontrolü"""
        net = veri.get('net_tutar', 0)
        kdv = veri.get('kdv', 0)
        brut = veri.get('brut_tutar', 0)
        
        if brut > 0 and net > 0:
            if abs(net + kdv - brut) > 1.0:
                return {
                    'hata': 'MATEMATIKSEL_HATA',
                    'aciklama': f'Net({net}) + KDV({kdv}) = {net+kdv}, Brüt={brut}',
                    'seviye': 'KRITIK'
                }
        return None
    
    def _belge_kontrol(self, veri):
        """Eksik belge, çifte kayıt kontrolü"""
        # Burada veritabanı kontrolü yapılacak
        # Şimdilik None döndür (hata yok)
        return None
    
    def _mutabakat_kontrol(self, veri):
        """Z-Raporu vs Banka kontrolü"""
        # Z-Raporu ile banka ekstresi karşılaştır
        return None
    
    def _mevzuat_kontrol(self, veri):
        """KDV oranı mevzuata uygun mu"""
        # KDV oranları güncel mi kontrol et
        return None


def dogrula(veri):
    """
    Veriyi doğrula (fonksiyon versiyonu)
    """
    motor = DogrulamaMotoru()
    return motor.dogrula(veri)