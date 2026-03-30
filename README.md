# Engineering Dashboard

A Docker-based engineering monitoring dashboard that combines:

- **React + Vite frontend**
- **FastAPI backend**
- **PostgreSQL** for telemetry and ML data
- **Grafana** for dashboards
- **Prometheus** for monitoring metrics
- **Desktop launcher EXE** for one-click startup on Windows

## Main features

- Main dashboard for telemetry, raw sensor values, and FFT spectrum data
- Grafana integration for dashboard visualization
- Prometheus monitoring and health summary
- ML prediction and ML monitoring workflow with `ml_test_db`
- Admin tools for simulator control and data reset
- Docker launcher flow for:
  - Start system
  - Stop system
  - Reset dashboard data

## Project structure

```text
.
├─ backend/
├─ engineering-dashboard/
├─ grafana/
├─ postgres/
├─ prometheus/
├─ scripts/
├─ .env
├─ docker-compose.yml
├─ launcher.py
├─ start_dashboard.bat
├─ stop_dashboard.bat
├─ reset_dashboard.bat
└─ Engineering Dashboard Launcher.exe
```

## Requirements

- Docker Desktop
- Python 3.11+ (only needed if rebuilding the launcher)
- Node.js (only needed for local frontend development outside Docker)

## Environment setup

Create or update `.env` with the required values:

```env
POSTGRES_DB=engineering_dashboard
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_PORT=5432

BACKEND_PORT=8000
FRONTEND_PORT=5173
PROMETHEUS_PORT=9090
GRAFANA_PORT=4000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin

VITE_API_BASE_URL=http://localhost:8000
VITE_GRAFANA_URL=http://localhost:4000
VITE_PROMETHEUS_URL=http://localhost:9090
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:4173,http://localhost:3000,http://localhost:4000,http://localhost:9090,http://127.0.0.1:5173,http://127.0.0.1:4173,http://127.0.0.1:3000,http://127.0.0.1:4000,http://127.0.0.1:9090
```

## Database initialization

The project uses Docker init scripts under `postgres/`.

Recommended setup:

- `engineering_dashboard` is created automatically by `POSTGRES_DB`
- `ml_test_db` is created by SQL init script
- main telemetry tables are created in `engineering_dashboard`
- ML tables are created in `ml_test_db`

Example init sequence:

- `01_create_databases.sql`
- `02_create_engineering_tables.sql`
- `03_create_ml_tables.sql`

## Start the system

### Option 1: Batch files

Run:

```powershell
start_dashboard.bat
```

Stop with:

```powershell
stop_dashboard.bat
```

Reset all Docker volumes and restart:

```powershell
reset_dashboard.bat
```

### Option 2: Desktop launcher

Run:

```text
Engineering Dashboard Launcher.exe
```

The launcher can:

- Start the system
- Stop the system
- Reset dashboard data
- Open Dashboard
- Open Grafana
- Open Backend
- Open Prometheus

## Access URLs

After startup:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Grafana: `http://localhost:4000`
- Prometheus: `http://localhost:9090`

## Main dashboard options endpoint

The frontend loads telemetry devices and sensors dynamically from:

```text
GET /main-dashboard/options
```

Example response:

```json
{
  "telemetry_devices": ["sensor_01", "sensor_02", "sensor_03"],
  "sensors": ["vibration_1", "vibration_2", "vibration_3"]
}
```

## ML database notes

ML prediction save flows use `ml_test_db`.

Make sure tables such as `ml_prediction_tests` match the backend schema, including fields like:

- `model_name`
- `predicted_label`
- `confidence`
- `rms`
- `peak`
- `kurtosis`
- `skewness`
- `crest_factor`
- `fft_peak_freq`
- `fft_peak_amp`
- `probabilities_json`
- `created_at`

## Rebuilding the launcher EXE

Install PyInstaller:

```powershell
pip install pyinstaller
```

Build:

```powershell
pyinstaller --onefile --windowed --name "Engineering Dashboard Launcher" launcher.py
```

Copy the EXE from `dist/` to the project root:

```powershell
copy /Y ".\dist\Engineering Dashboard Launcher.exe" ".\Engineering Dashboard Launcher.exe"
```

## Docker troubleshooting

### Postgres unhealthy on startup

Check logs:

```powershell
docker logs engineering_postgres
```

Common cause:

- duplicate database creation for `engineering_dashboard` in SQL init scripts while `POSTGRES_DB=engineering_dashboard` is already set.

### Reset everything

```powershell
docker compose down -v
docker compose up -d --build
```

## Recommended Git workflow

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Notes

- Keep the launcher EXE in the project root beside the batch files and `docker-compose.yml`
- Docker Desktop must be running before using the launcher
- Main dashboard device and sensor dropdowns are loaded from the database instead of hardcoded lists
