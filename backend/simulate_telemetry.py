# simulate_telemetry.py
import time
import random
from datetime import datetime
from urllib.parse import urlparse

import psycopg2

DATABASE_URL = (
    "postgresql+psycopg2://postgres:126523@localhost:5432/engineering_dashboard"
)

# Change this to 10, 20, 50, etc.
DEVICE_COUNT = 10
DEVICES = [f"sensor_{i:02d}" for i in range(1, DEVICE_COUNT + 1)]

# Simulation ranges
NORMAL_TEMP_RANGE = (24.0, 27.0)
WARNING_HIGH_RANGE = (28.2, 29.8)
WARNING_LOW_RANGE = (20.2, 21.8)
CRITICAL_HIGH_RANGE = (31.0, 33.0)
CRITICAL_LOW_RANGE = (17.5, 19.5)
HUMIDITY_RANGE = (55.0, 65.0)

# Cycle timing
SLEEP_SECONDS = 10

# Optional offline simulation
ENABLE_OFFLINE_PHASE = True
OFFLINE_PHASE_SECONDS = 40  # shorten for testing delay alerts quickly


def convert_sqlalchemy_url_to_psycopg2(url: str) -> str:
    """
    Convert:
      postgresql+psycopg2://user:pass@host:5432/dbname
    to:
      postgresql://user:pass@host:5432/dbname
    """
    return url.replace("postgresql+psycopg2://", "postgresql://", 1)


def get_connection():
    psycopg2_url = convert_sqlalchemy_url_to_psycopg2(DATABASE_URL)
    return psycopg2.connect(psycopg2_url)


def rand_range(bounds: tuple[float, float]) -> float:
    return round(random.uniform(bounds[0], bounds[1]), 1)


def insert_row(cur, device_name: str, temperature: float, humidity: float) -> None:
    cur.execute(
        """
        INSERT INTO telemetry (time, device_name, temperature, humidity)
        VALUES (%s, %s, %s, %s)
        """,
        (datetime.now(), device_name, temperature, humidity),
    )


def generate_normal(cur) -> None:
    for device in DEVICES:
        temp = rand_range(NORMAL_TEMP_RANGE)
        hum = rand_range(HUMIDITY_RANGE)
        insert_row(cur, device, temp, hum)


def generate_warning(cur, affected_count: int = 2) -> None:
    affected = set(random.sample(DEVICES, min(affected_count, len(DEVICES))))
    for i, device in enumerate(DEVICES):
        if device in affected:
            # Alternate between high-warning and low-warning for realism
            temp = rand_range(WARNING_HIGH_RANGE if i % 2 == 0 else WARNING_LOW_RANGE)
        else:
            temp = rand_range(NORMAL_TEMP_RANGE)
        hum = rand_range(HUMIDITY_RANGE)
        insert_row(cur, device, temp, hum)


def generate_critical(cur, affected_count: int = 1) -> None:
    affected = set(random.sample(DEVICES, min(affected_count, len(DEVICES))))
    for i, device in enumerate(DEVICES):
        if device in affected:
            # Alternate between high-critical and low-critical
            temp = rand_range(CRITICAL_HIGH_RANGE if i % 2 == 0 else CRITICAL_LOW_RANGE)
        else:
            temp = rand_range(NORMAL_TEMP_RANGE)
        hum = rand_range(HUMIDITY_RANGE)
        insert_row(cur, device, temp, hum)


def print_phase_header(phase_name: str) -> None:
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] {phase_name}")


def main() -> None:
    conn = get_connection()
    conn.autocommit = True
    cur = conn.cursor()

    print(f"Connected to database. Starting simulation for {DEVICE_COUNT} devices...")
    print("Press Ctrl+C to stop.")

    cycle = 0

    try:
        while True:
            cycle += 1

            # 1-4: NORMAL
            if 1 <= cycle <= 4:
                print_phase_header(f"CYCLE {cycle} - NORMAL")
                generate_normal(cur)

            # 5-8: WARNING
            elif 5 <= cycle <= 8:
                print_phase_header(f"CYCLE {cycle} - WARNING")
                generate_warning(cur, affected_count=max(2, DEVICE_COUNT // 10))

            # 9-12: CRITICAL
            elif 9 <= cycle <= 12:
                print_phase_header(f"CYCLE {cycle} - CRITICAL")
                generate_critical(cur, affected_count=max(1, DEVICE_COUNT // 20))

            # 13-16: RECOVERY
            elif 13 <= cycle <= 16:
                print_phase_header(f"CYCLE {cycle} - RECOVERY")
                generate_normal(cur)

            # 17: OFFLINE PAUSE
            elif cycle == 17 and ENABLE_OFFLINE_PHASE:
                print_phase_header("OFFLINE PHASE - NO INSERTS")
                print(f"Pausing inserts for {OFFLINE_PHASE_SECONDS} seconds...")
                time.sleep(OFFLINE_PHASE_SECONDS)

            else:
                cycle = 0
                continue

            # Print a quick summary to terminal
            print(f"Inserted rows for {len(DEVICES)} devices.")
            time.sleep(SLEEP_SECONDS)

    except KeyboardInterrupt:
        print("\nSimulation stopped by user.")
    finally:
        cur.close()
        conn.close()
        print("Database connection closed.")


if __name__ == "__main__":
    main()