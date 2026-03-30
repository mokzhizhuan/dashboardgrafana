from datetime import datetime
from typing import Any, Dict, List, Optional

import asyncpg

from .config import DATABASE_URL


db_pool: Optional[asyncpg.Pool] = None


def _asyncpg_dsn(url: str) -> str:
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql://", 1)
    if url.startswith("postgres+psycopg2://"):
        return url.replace("postgres+psycopg2://", "postgres://", 1)
    return url

async def init_db_pool():
    global db_pool
    if db_pool is None:
        dsn = _asyncpg_dsn(DATABASE_URL)
        db_pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)


async def close_db_pool() -> None:
    global db_pool
    if db_pool is not None:
        await db_pool.close()
        db_pool = None


async def ensure_table() -> None:
    await init_db_pool()
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS telemetry (
                id SERIAL PRIMARY KEY,
                time TIMESTAMP NOT NULL DEFAULT NOW(),
                device_name VARCHAR NOT NULL,
                temperature DOUBLE PRECISION NOT NULL,
                humidity DOUBLE PRECISION NOT NULL
            );
            """
        )


async def insert_telemetry_row(
    device_name: str,
    ts: datetime,
    temperature: float,
    humidity: float,
) -> None:
    await insert_telemetry_rows(
        [
            {
                "device_name": device_name,
                "time": ts,
                "temperature": temperature,
                "humidity": humidity,
            }
        ]
    )


async def insert_telemetry_rows(rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return

    await init_db_pool()
    async with db_pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO telemetry (device_name, time, temperature, humidity)
            VALUES ($1, $2, $3, $4)
            """,
            [
                (r["device_name"], r["time"], r["temperature"], r["humidity"])
                for r in rows
            ],
        )


async def query_last_n_temps(device_name: str, limit: int = 3) -> List[float]:
    await init_db_pool()
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT temperature
            FROM telemetry
            WHERE device_name = $1
            ORDER BY time DESC
            LIMIT $2
            """,
            device_name,
            limit,
        )
    return [float(r["temperature"]) for r in rows]

async def get_telemetry_metrics_snapshot() -> tuple[int, Optional[datetime]]:
    await init_db_pool()
    async with db_pool.acquire() as conn:
        total_rows = await conn.fetchval("SELECT COUNT(*) FROM telemetry")
        latest_time = await conn.fetchval("SELECT MAX(time) FROM telemetry")
    return int(total_rows or 0), latest_time

async def get_telemetry_row_count() -> int:
    await init_db_pool()
    async with db_pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM telemetry")
    return int(count or 0)


async def delete_telemetry_rows(ids: List[int]) -> int:
    if not ids:
        return 0

    await init_db_pool()
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            """
            DELETE FROM telemetry
            WHERE id = ANY($1::int[])
            """,
            ids,
        )
    return int(result.split()[-1])


async def truncate_telemetry_table() -> None:
    await init_db_pool()
    async with db_pool.acquire() as conn:
        await conn.execute("TRUNCATE TABLE telemetry RESTART IDENTITY")

async def get_telemetry_row_count() -> int:
    await init_db_pool()
    async with db_pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM telemetry")
    return int(count or 0)