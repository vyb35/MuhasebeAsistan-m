# backend/app/main.py
import sys
from pathlib import Path

# Python'a services klasörünü göster
sys.path.insert(0, str(Path(__file__).parent))

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Servisler
from services import (
    gemini_oku,
    DogrulamaMotoru,
    IslemMotoru,
    ExcelService,
    NotificationService,
    YardimciServisler
)

from api.routes import router

# FastAPI uygulaması
app = FastAPI(
    title="MuhasebeAI API",
    version="1.0.0",
    description="Mali müşavirler için AI destekli belge okuma ve beyanname hazırlama sistemi"
)

# CORS yapılandırması
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotalar
app.include_router(router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "title": "MuhasebeAI API",
        "version": "1.0.0",
        "services": {
            "gemini": "connected" if os.getenv("GEMINI_API_KEY") else "missing"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)