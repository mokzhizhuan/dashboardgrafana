from fastapi import APIRouter, UploadFile, File, HTTPException
from sqlalchemy import create_engine, text
import csv
import io

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

DATABASE_URL = (
    "postgresql+psycopg2://postgres:126523@localhost:5432/engineering_dashboard"
)
engine = create_engine(DATABASE_URL)


@router.post("/upload-csv")
async def upload_telemetry_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")

    content = await file.read()

    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(decoded))

    required_columns = {"time", "device_name", "temperature", "humidity"}
    if not reader.fieldnames or not required_columns.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {sorted(required_columns)}",
        )

    rows = []
    for idx, row in enumerate(reader, start=1):
        try:
            rows.append(
                {
                    "time": row["time"],
                    "device_name": row["device_name"],
                    "temperature": float(row["temperature"]),
                    "humidity": float(row["humidity"]),
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid row at line {idx + 1}: {str(e)}"
            )

    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no data rows.")

    insert_sql = text(
        """
        INSERT INTO telemetry (time, device_name, temperature, humidity)
        VALUES (:time, :device_name, :temperature, :humidity)
    """
    )

    with engine.begin() as conn:
        conn.execute(insert_sql, rows)

    return {"message": "CSV uploaded successfully", "inserted_rows": len(rows)}
