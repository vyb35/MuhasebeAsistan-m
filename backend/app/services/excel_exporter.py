# services/excel_exporter.py
import pandas as pd
from io import BytesIO

class ExcelService:
    def belgelerden_excel_olustur(self, belgeler):
        """Belge listesinden Excel oluştur"""
        df = pd.DataFrame([{
            'Tarih': b.get('tarih', ''),
            'Belge Türü': b.get('belge_turu', ''),
            'Firma': b.get('firma_adi', ''),
            'Vergi No': b.get('vergi_no', ''),
            'Açıklama': b.get('aciklama', ''),
            'Net Tutar': b.get('net_tutar', 0),
            'KDV Oranı (%)': b.get('kdv_orani', 0),
            'KDV Tutarı': b.get('kdv_tutari', 0),
            'Brüt Tutar': b.get('brut_tutar', 0),
            'Vergi Kodu': b.get('vergi_kodu', '0015')
        } for b in belgeler])
        
        # Excel oluştur
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Belgeler')
            
            # Özet sayfası
            ozet = self._ozet_olustur(belgeler)
            ozet_df = pd.DataFrame([ozet])
            ozet_df.to_excel(writer, index=False, sheet_name='Özet')
        
        return output.getvalue()
    
    def _ozet_olustur(self, belgeler):
        """Özet istatistikler"""
        toplam_net = sum(b.get('net_tutar', 0) for b in belgeler)
        toplam_kdv = sum(b.get('kdv_tutari', 0) for b in belgeler)
        
        return {
            'Toplam Net': toplam_net,
            'Toplam KDV': toplam_kdv,
            'Toplam Brüt': toplam_net + toplam_kdv,
            'Belge Sayısı': len(belgeler)
        }


def excel_olustur(belgeler):
    """
    Belge listesinden Excel oluştur (fonksiyon versiyonu)
    """
    service = ExcelService()
    return service.belgelerden_excel_olustur(belgeler)
