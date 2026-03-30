const { spawn, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const workspaceDir = path.resolve(__dirname, ".."); // dash - Copy
const frontendDir = path.join(workspaceDir, "engineering-dashboard");
const backendDir = path.join(workspaceDir, "backend");
const prometheusDir = path.join(workspaceDir, "prometheus");

const PROMETHEUS_EXE = path.join(prometheusDir, "prometheus.exe");
const PROMETHEUS_CONFIG = path.join(prometheusDir, "prometheus.yml");

// Change this if your FastAPI entry is different
const FASTAPI_APP = "main:app";

function isWindows() {
  return process.platform === "win32";
}

function isRunningAsAdmin() {
  if (!isWindows()) return true;

  try {
    execSync("net session", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureAdmin() {
  if (isWindows() && !isRunningAsAdmin()) {
    console.error("This script must be run as Administrator.");
    console.error("Please reopen PowerShell or CMD with 'Run as administrator' and try again.");
    process.exit(1);
  }
}

function spawnProcess(label, command, args, options = {}) {
  console.log(`[START] ${label}`);

  const child = spawn(command, args, {
    cwd: options.cwd || workspaceDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (err) => {
    console.error(`[ERROR] ${label}: ${err.message}`);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[EXIT] ${label} stopped with code ${code}`);
    }
  });

  return child;
}

function findPythonCommand() {
  const venvPython = path.join(backendDir, "venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) {
    return `"${venvPython}"`;
  }
  return "python";
}

function startFrontend() {
  return spawnProcess("React frontend", "npm", ["run", "dev"], {
    cwd: frontendDir,
  });
}

function startFastAPI() {
  const pythonCmd = findPythonCommand();

  return spawnProcess("FastAPI / Uvicorn", pythonCmd, [
    "-m",
    "uvicorn",
    FASTAPI_APP,
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
    "--reload",
  ], {
    cwd: backendDir,
  });
}

function startPrometheus() {
  if (!fs.existsSync(PROMETHEUS_EXE)) {
    console.error(`[ERROR] Prometheus executable not found: ${PROMETHEUS_EXE}`);
    return null;
  }

  if (!fs.existsSync(PROMETHEUS_CONFIG)) {
    console.error(`[ERROR] Prometheus config not found: ${PROMETHEUS_CONFIG}`);
    return null;
  }

  return spawnProcess("Prometheus", `"${PROMETHEUS_EXE}"`, [
    `--config.file="${PROMETHEUS_CONFIG}"`,
    "--web.listen-address=:9090",
  ], {
    cwd: prometheusDir,
  });
}

function main() {
  ensureAdmin();

  console.log("Running with Administrator privileges.");
  console.log(`Workspace: ${workspaceDir}`);
  console.log(`Frontend:  ${frontendDir}`);
  console.log(`Backend:   ${backendDir}`);
  console.log(`Prometheus:${prometheusDir}`);

  startFrontend();
  startFastAPI();
  startPrometheus();

  console.log("");
  console.log("Services starting:");
  console.log("- React:       http://localhost:5173");
  console.log("- FastAPI:     http://localhost:8000");
  console.log("- Prometheus:  http://localhost:9090");
  console.log("- Metrics URL: http://localhost:8000/prometheus/metrics");
}

main();