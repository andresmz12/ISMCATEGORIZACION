import os
import re
import json
import base64
import hashlib
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import jwt, JWTError

from classifier import process_file_full

# ── Config ─────────────────────────────────────────────────────────────────
SECRET_KEY     = os.environ.get("JWT_SECRET", "ism-taxes-dev-secret-2024")
ALGORITHM      = "HS256"
TOKEN_HOURS    = 8
USERS_FILE     = Path(__file__).parent / "users.json"
ADMIN_EMAIL    = os.environ.get("ADMIN_EMAIL", "admin@ismtaxes.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ISMAdmin2024")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

bearer = HTTPBearer()

app = FastAPI(title="ISM Taxes API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://passionate-passion-production-7f4a.up.railway.app",
        "https://ismcategorizacion-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Users (JSON file) ───────────────────────────────────────────────────────
def load_users() -> dict:
    if USERS_FILE.exists():
        return json.loads(USERS_FILE.read_text())
    return {}

def save_users(users: dict):
    USERS_FILE.write_text(json.dumps(users, indent=2))

def ensure_admin():
    users = load_users()
    if ADMIN_EMAIL not in users:
        users[ADMIN_EMAIL] = {
            "password": hash_password(ADMIN_PASSWORD),
            "role": "admin",
        }
        save_users(users)

@app.on_event("startup")
def on_startup():
    ensure_admin()

# ── Auth helpers ────────────────────────────────────────────────────────────
def create_token(email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": email, "role": role, "exp": expire}, SECRET_KEY, ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    return decode_token(creds.credentials)

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user

# ── Auth endpoints ──────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ISM Taxes API running"}

@app.post("/auth/login")
async def login(body: dict):
    email    = body.get("email", "")
    password = body.get("password", "")
    users    = load_users()
    if email not in users or not verify_password(password, users[email]["password"]):
        raise HTTPException(401, "Invalid credentials")
    role  = users[email]["role"]
    token = create_token(email, role)
    return {"access_token": token, "email": email, "role": role}

@app.get("/auth/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = load_users()
    return [{"email": e, "role": d["role"]} for e, d in users.items()]

@app.post("/auth/users")
async def create_user(body: dict, admin: dict = Depends(require_admin)):
    email    = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(400, "Email and password required")
    users = load_users()
    if email in users:
        raise HTTPException(400, "User already exists")
    users[email] = {"password": hash_password(password), "role": "user"}
    save_users(users)
    return {"email": email, "role": "user"}

# ── Classify endpoint ───────────────────────────────────────────────────────
@app.post("/classify")
async def classify(
    file: UploadFile = File(...),
    company_name: str = Form(...),
    year: str = Form("2025"),
    industry: str = Form("Other"),
    entity: str = Form("Sole Proprietor (Schedule C)"),
    user: dict = Depends(get_current_user),
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["xlsx", "xls", "csv", "pdf"]:
        raise HTTPException(400, "Only .xlsx, .xls, .csv or .pdf files are accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        out_path, summary = process_file_full(
            file_path=tmp_path,
            file_ext=ext,
            company_name=company_name,
            year=year,
            industry=industry,
            entity=entity,
        )
        with open(out_path, "rb") as f:
            file_b64 = base64.b64encode(f.read()).decode()
        os.unlink(out_path)
        filename = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', company_name)}_IRS_Categories_{year}.xlsx"
        return {"summary": summary, "file_b64": file_b64, "filename": filename}
    except Exception as e:
        raise HTTPException(500, f"Processing error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
