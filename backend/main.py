import os
import re
import base64
import hashlib
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import jwt, JWTError

from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from classifier import process_file_full

# ── Config ─────────────────────────────────────────────────────────────────
SECRET_KEY     = os.environ.get("JWT_SECRET", "ism-taxes-dev-secret-2024")
ALGORITHM      = "HS256"
TOKEN_HOURS    = 8
ADMIN_EMAIL    = os.environ.get("ADMIN_EMAIL", "admin@ismtaxes.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ISMAdmin2024")

DB_PATH = os.environ.get("DB_PATH", "/app/data/users.db")
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

# ── Models ──────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_admin      = Column(Boolean, default=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    last_login    = Column(DateTime, nullable=True)
    reports_count = Column(Integer, default=0)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# ── Startup ─────────────────────────────────────────────────────────────────
def ensure_admin(db: Session):
    if not db.query(User).filter(User.email == ADMIN_EMAIL).first():
        db.add(User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            is_admin=True,
            is_active=True,
            created_at=datetime.utcnow(),
            reports_count=0,
        ))
        db.commit()

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_admin(db)
    finally:
        db.close()

# ── Auth helpers ─────────────────────────────────────────────────────────────
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

# ── Auth endpoints ───────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ISM Taxes API running"}

@app.post("/auth/login")
async def login(body: dict, db: Session = Depends(get_db)):
    email    = body.get("email", "")
    password = body.get("password", "")
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")
    user.last_login = datetime.utcnow()
    db.commit()
    role  = "admin" if user.is_admin else "user"
    token = create_token(email, role)
    return {"access_token": token, "email": email, "role": role}

@app.get("/auth/users")
async def list_users(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    return [
        {
            "email": u.email,
            "role": "admin" if u.is_admin else "user",
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "active": u.is_active,
            "report_count": u.reports_count or 0,
        }
        for u in db.query(User).all()
    ]

@app.post("/auth/users")
async def create_user(body: dict, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    email    = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(400, "Email and password required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "User already exists")
    db.add(User(
        email=email,
        password_hash=hash_password(password),
        is_admin=False,
        is_active=True,
        created_at=datetime.utcnow(),
        reports_count=0,
    ))
    db.commit()
    return {"email": email, "role": "user"}

@app.put("/auth/users/{email}")
async def update_user(email: str, body: dict, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")
    if body.get("password"):
        user.password_hash = hash_password(body["password"])
    if "active" in body:
        user.is_active = bool(body["active"])
    new_email = body.get("new_email", "").strip()
    if new_email and new_email != email:
        if db.query(User).filter(User.email == new_email).first():
            raise HTTPException(400, "Email already in use")
        user.email = new_email
        db.commit()
        return {"email": new_email}
    db.commit()
    return {"email": user.email}

@app.delete("/auth/users/{email}")
async def delete_user(email: str, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")
    if email == admin["sub"]:
        raise HTTPException(400, "Cannot delete your own account")
    db.delete(user)
    db.commit()
    return {"deleted": email}

# ── Classify endpoint ────────────────────────────────────────────────────────
@app.post("/classify")
async def classify(
    file: UploadFile = File(...),
    company_name: str = Form(...),
    year: str = Form("2025"),
    industry: str = Form("Other"),
    entity: str = Form("Sole Proprietor (Schedule C)"),
    notes: str = Form(""),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
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
            notes=notes,
        )
        db_user = db.query(User).filter(User.email == user["sub"]).first()
        if db_user:
            db_user.reports_count = (db_user.reports_count or 0) + 1
            db.commit()
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
