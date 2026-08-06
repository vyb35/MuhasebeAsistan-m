# services/redis.py
import redis as redis_lib
from pathlib import Path
import os

class RedisClient:
    """Redis bağlantı yöneticisi"""
    
    def __init__(self):
        self.client = None
        self.connected = False
        self._baglan()
    
    def _baglan(self):
        """Redis'e bağlan"""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self.client = redis_lib.from_url(redis_url)
            self.connected = True
            print("Redis bağlantısı başarılı.")
        except Exception as e:
            print(f"Redis bağlantı hatası: {e}")
            self.connected = False
    
    def ping(self):
        """Bağlantıyı kontrol et"""
        if self.client and self.connected:
            try:
                return self.client.ping()
            except:
                return False
        return False
    
    def set(self, key, value, expire=None):
        """Değer kaydet"""
        if self.client and self.connected:
            try:
                self.client.set(key, value, ex=expire)
                return True
            except:
                return False
        return False
    
    def get(self, key):
        """Değer al"""
        if self.client and self.connected:
            try:
                return self.client.get(key)
            except:
                return None
        return None
    
    def delete(self, key):
        """Değer sil"""
        if self.client and self.connected:
            try:
                self.client.delete(key)
                return True
            except:
                return False
        return False


# ✅ TEK BİR INSTANCE (Singleton)
redis_client = RedisClient()

def redis_baglan():
    """Redis bağlantısını döndür"""
    return redis_client

def redis_ayarla(key, value, expire=None):
    """Değer kaydet (fonksiyon versiyonu)"""
    return redis_client.set(key, value, expire)

def redis_al(key):
    """Değer al (fonksiyon versiyonu)"""
    return redis_client.get(key)