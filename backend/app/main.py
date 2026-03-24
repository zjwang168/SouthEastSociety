from fastapi import FastAPI
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine, SessionLocal
from . import models  # noqa: F401

from .routers.auth import router as auth_router, bootstrap_admin
from .routers.customers import router as customers_router
from .routers.orders import router as orders_router
from .routers.sms import router as sms_router
from .routers.audit import router as audit_router
from .routers.dashboard import router as dashboard_router

app = FastAPI(title="SouthEastSociety - Internal Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://south-east-society.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def startup():
    db: Session = SessionLocal()
    try:
        bootstrap_admin(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(orders_router)
app.include_router(sms_router, prefix="/sms", tags=["sms"])
app.include_router(audit_router)
app.include_router(dashboard_router)