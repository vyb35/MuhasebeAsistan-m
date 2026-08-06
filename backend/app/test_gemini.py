from services.gemini import read_invoice
import json
import pandas as pd


result = read_invoice(
    "backend/app/uploads/fatura.png"
)


js=json.dumps(
    result,
    indent=4,
    ensure_ascii=False
)
df=pd.DataFrame([result])
df.to_csv('faturalar.csv')
