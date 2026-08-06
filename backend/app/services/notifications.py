# services/notifications.py

class NotificationService:
    def __init__(self):
        pass
    
    def uyari_gonder(self, kullanici, mesaj, seviye='info'):
        """Uyarı bildirimi gönder"""
        print(f"UYARI ({seviye}) -> {kullanici}: {mesaj}")
        
        if seviye == 'kritik':
            print(f"   Email gönderildi: {mesaj}")
            print(f"   SMS gönderildi: {mesaj}")
        else:
            print(f"   Email gönderildi: {mesaj}")
    
    def ay_sonu_hatirlatma(self, kullanici):
        """Ay sonu beyanname hatırlatması"""
        son_gun = "26"
        mesaj = f"""
        Beyanname son günü: {son_gun}
        Lütfen tüm belgeleri kontrol edin.
        Beyanname hazırlamak için tıklayın.
        """
        print(f"AY SONU HATIRLATMA -> {kullanici}: {mesaj}")


def bildirim_gonder(kullanici, mesaj, seviye='info'):
    """
    Bildirim gönder (fonksiyon versiyonu)
    """
    service = NotificationService()
    return service.uyari_gonder(kullanici, mesaj, seviye)


def ay_sonu_hatirlatma(kullanici):
    """
    Ay sonu hatırlatma gönder (fonksiyon versiyonu)
    """
    service = NotificationService()
    return service.ay_sonu_hatirlatma(kullanici)