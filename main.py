import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

DB_PATH = os.getenv("DB_PATH", "/data/logitrack.db")
STATUSES = ("Pending", "In Transit", "Delivered", "Delayed")


def connect_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@asynccontextmanager
async def lifespan(app: FastAPI):
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS shipments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_number TEXT UNIQUE NOT NULL,
                recipient TEXT NOT NULL,
                destination TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
    yield


app = FastAPI(
    title="LogiTrack API",
    description="Resilient shipment tracking with persistent storage and recovery monitoring.",
    version="1.0.0",
    lifespan=lifespan,
)


class ShipmentCreate(BaseModel):
    tracking_number: str = Field(min_length=3, max_length=50)
    recipient: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=200)
    status: Literal["Pending", "In Transit", "Delivered", "Delayed"] = "Pending"


class ShipmentUpdate(BaseModel):
    status: Literal["Pending", "In Transit", "Delivered", "Delayed"]


def shipment_dict(row):
    return dict(row)


@app.get("/")
def root():
    return {"service": "LogiTrack", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    try:
        with connect_db() as conn:
            conn.execute("SELECT 1").fetchone()
        return {
            "status": "healthy",
            "service": "LogiTrack",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")


@app.post("/shipments", status_code=201)
def create_shipment(shipment: ShipmentCreate):
    now = datetime.now(timezone.utc).isoformat()
    try:
        with connect_db() as conn:
            cursor = conn.execute(
                """INSERT INTO shipments
                (tracking_number, recipient, destination, status, updated_at)
                VALUES (?, ?, ?, ?, ?)""",
                (shipment.tracking_number, shipment.recipient,
                 shipment.destination, shipment.status, now),
            )
            row = conn.execute(
                "SELECT * FROM shipments WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
            return shipment_dict(row)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Tracking number already exists")


@app.get("/shipments")
def list_shipments():
    with connect_db() as conn:
        rows = conn.execute("SELECT * FROM shipments ORDER BY id").fetchall()
        return [shipment_dict(row) for row in rows]


@app.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: int):
    with connect_db() as conn:
        row = conn.execute(
            "SELECT * FROM shipments WHERE id = ?", (shipment_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment_dict(row)


@app.patch("/shipments/{shipment_id}")
def update_shipment(shipment_id: int, update: ShipmentUpdate):
    now = datetime.now(timezone.utc).isoformat()
    with connect_db() as conn:
        cursor = conn.execute(
            "UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?",
            (update.status, now, shipment_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Shipment not found")
        row = conn.execute(
            "SELECT * FROM shipments WHERE id = ?", (shipment_id,)
        ).fetchone()
        return shipment_dict(row)
