from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from classifier import process_file
app = FastAPI(title="ISM Taxes API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {"status": "ISM Taxes API running"}
@app.post("/classify")
async def classify(
    file: UploadFile = File(...),
    company_name: str = Form(...),
    year: str = Form("2025"),
    industry: str = Form("Other"),
    entity: str = Form("Sole Proprietor (Schedule C)"),
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["xlsx", "xls", "csv", "pdf"]:
        raise HTTPException(400, "Solo se aceptan archivos .xlsx, .xls, .csv o .pdf")
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        out_path = process_file(
            file_path=tmp_path,
            file_ext=ext,
            company_name=company_name,
            year=year,
            industry=industry,
            entity=entity,
        )
        filename = f"{company_name.replace(' ', '_')}_IRS_Categories_{year}.xlsx"
        return FileResponse(
            path=out_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
        )
    except Exception as e:
        raise HTTPException(500, f"Error al procesar: {str(e)}")
    finally:
        os.unlink(tmp_path)
