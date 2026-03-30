import os
import sys
import threading
import tkinter as tk
from tkinter import messagebox
import urllib.request
import webbrowser

WINDOW_TITLE = "Engineering Dashboard Launcher"

# Change this to your server IP or domain
# Example:
# SERVER_HOST = "192.168.1.50"
# SERVER_HOST = "dashboard.company.local"
SERVER_HOST = "192.168.4.89"

FRONTEND_URL = f"http://{SERVER_HOST}:5173"
BACKEND_URL = f"http://{SERVER_HOST}:8000"
GRAFANA_URL = f"http://{SERVER_HOST}:4000"
PROMETHEUS_URL = f"http://{SERVER_HOST}:9090"

BASE_DIR = os.path.dirname(os.path.abspath(sys.argv[0]))


class DashboardLauncher:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(WINDOW_TITLE)

        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()

        window_w = min(1280, int(screen_w * 0.82))
        window_h = min(860, int(screen_h * 0.84))

        x = max(0, (screen_w - window_w) // 2)
        y = max(0, (screen_h - window_h) // 2)

        self.root.geometry(f"{window_w}x{window_h}+{x}+{y}")
        self.root.minsize(980, 700)
        self.root.configure(bg="#f4f6f8")

        self.status_vars = {
            "dashboard": tk.StringVar(value="Checking..."),
            "backend": tk.StringVar(value="Checking..."),
            "grafana": tk.StringVar(value="Checking..."),
            "prometheus": tk.StringVar(value="Checking..."),
        }

        self._build_ui()
        self.refresh_status_async()

    def _build_ui(self) -> None:
        main = tk.Frame(self.root, bg="#f4f6f8", padx=16, pady=16)
        main.pack(fill="both", expand=True)

        header = tk.Frame(main, bg="#1f2937", padx=20, pady=18)
        header.pack(fill="x")

        tk.Label(
            header,
            text="Engineering Dashboard Launcher",
            font=("Segoe UI", 21, "bold"),
            fg="white",
            bg="#1f2937",
        ).pack(anchor="w")

        tk.Label(
            header,
            text="Server-connected launcher for Dashboard, Backend, Grafana, and Prometheus",
            font=("Segoe UI", 11),
            fg="#d1d5db",
            bg="#1f2937",
        ).pack(anchor="w", pady=(6, 0))

        body = tk.Frame(main, bg="#f4f6f8")
        body.pack(fill="both", expand=True, pady=(16, 0))

        left = tk.Frame(body, bg="#ffffff", bd=1, relief="solid", padx=16, pady=16)
        left.pack(side="left", fill="both", expand=True, padx=(0, 8))

        right = tk.Frame(body, bg="#ffffff", bd=1, relief="solid", padx=16, pady=16)
        right.pack(side="left", fill="both", expand=True, padx=(8, 0))

        tk.Label(
            left,
            text="Service Access",
            font=("Segoe UI", 16, "bold"),
            bg="#ffffff",
            fg="#111827",
        ).pack(anchor="w", pady=(0, 14))

        self._make_button(left, "Open Dashboard", lambda: self.open_url(FRONTEND_URL), "#2563eb")
        self._make_button(left, "Open Backend", lambda: self.open_url(BACKEND_URL), "#8b5cf6")
        self._make_button(left, "Open Grafana", lambda: self.open_url(GRAFANA_URL), "#f59e0b")
        self._make_button(left, "Open Prometheus", lambda: self.open_url(PROMETHEUS_URL), "#10b981")

        tk.Label(
            left,
            text="Utilities",
            font=("Segoe UI", 16, "bold"),
            bg="#ffffff",
            fg="#111827",
        ).pack(anchor="w", pady=(22, 14))

        self._make_button(left, "Refresh Status", self.refresh_status_async, "#059669")
        self._make_button(left, "Open All Services", self.open_all_services, "#0ea5e9")

        tk.Label(
            right,
            text="Service Status",
            font=("Segoe UI", 16, "bold"),
            bg="#ffffff",
            fg="#111827",
        ).pack(anchor="w", pady=(0, 14))

        self.status_labels = {}
        for key, title in [
            ("dashboard", "Dashboard"),
            ("backend", "Backend"),
            ("grafana", "Grafana"),
            ("prometheus", "Prometheus"),
        ]:
            row = tk.Frame(right, bg="#ffffff")
            row.pack(fill="x", pady=8)

            tk.Label(
                row,
                text=title,
                width=14,
                anchor="w",
                font=("Segoe UI", 12, "bold"),
                bg="#ffffff",
                fg="#111827",
            ).pack(side="left")

            label = tk.Label(
                row,
                textvariable=self.status_vars[key],
                width=18,
                anchor="w",
                font=("Segoe UI", 12),
                bg="#ffffff",
                fg="#374151",
            )
            label.pack(side="left", padx=(8, 0))
            self.status_labels[key] = label

        tk.Label(
            right,
            text="Server Configuration",
            font=("Segoe UI", 16, "bold"),
            bg="#ffffff",
            fg="#111827",
        ).pack(anchor="w", pady=(28, 14))

        config_box = tk.Frame(right, bg="#f9fafb", bd=1, relief="solid", padx=14, pady=14)
        config_box.pack(fill="x")

        for text in [
            f"Server Host: {SERVER_HOST}",
            f"Dashboard:   {FRONTEND_URL}",
            f"Backend:     {BACKEND_URL}",
            f"Grafana:     {GRAFANA_URL}",
            f"Prometheus:  {PROMETHEUS_URL}",
        ]:
            tk.Label(
                config_box,
                text=text,
                font=("Consolas", 11),
                bg="#f9fafb",
                fg="#111827",
                anchor="w",
                justify="left",
            ).pack(anchor="w", pady=4)

        tk.Label(
            right,
            text="Launcher Folder",
            font=("Segoe UI", 16, "bold"),
            bg="#ffffff",
            fg="#111827",
        ).pack(anchor="w", pady=(28, 14))

        folder_box = tk.Frame(right, bg="#f9fafb", bd=1, relief="solid", padx=14, pady=14)
        folder_box.pack(fill="x")

        tk.Label(
            folder_box,
            text=BASE_DIR,
            font=("Consolas", 10),
            bg="#f9fafb",
            fg="#111827",
            anchor="w",
            justify="left",
            wraplength=500,
        ).pack(anchor="w")

        footer = tk.Frame(main, bg="#f4f6f8")
        footer.pack(fill="x", pady=(12, 0))

        tk.Label(
            footer,
            text="Tip: This launcher connects to services running on a server. No local Docker is required.",
            font=("Segoe UI", 10),
            bg="#f4f6f8",
            fg="#4b5563",
        ).pack(anchor="w")

    def _make_button(self, parent, text: str, command, color: str) -> None:
        btn = tk.Button(
            parent,
            text=text,
            command=command,
            font=("Segoe UI", 11, "bold"),
            bg=color,
            fg="white",
            activebackground=color,
            activeforeground="white",
            relief="flat",
            bd=0,
            padx=12,
            pady=13,
            cursor="hand2",
        )
        btn.pack(fill="x", pady=6)

    def open_url(self, url: str) -> None:
        try:
            webbrowser.open(url)
        except Exception as exc:
            messagebox.showerror("Error", f"Failed to open URL.\n\n{exc}")

    def open_all_services(self) -> None:
        for url in [FRONTEND_URL, BACKEND_URL, GRAFANA_URL, PROMETHEUS_URL]:
            self.open_url(url)

    def refresh_status_async(self) -> None:
        for key in self.status_vars:
            self.status_vars[key].set("Checking...")
            self._set_status_color(key, "#374151")

        threading.Thread(target=self._refresh_status_worker, daemon=True).start()

    def _refresh_status_worker(self) -> None:
        statuses = {
            "dashboard": self._check_http(FRONTEND_URL),
            "backend": self._check_http(BACKEND_URL),
            "grafana": self._check_http(GRAFANA_URL),
            "prometheus": self._check_http(PROMETHEUS_URL),
        }
        self.root.after(0, lambda: self._apply_statuses(statuses))

    def _apply_statuses(self, statuses: dict[str, bool]) -> None:
        for key, ok in statuses.items():
            self.status_vars[key].set("Online" if ok else "Offline")
            self._set_status_color(key, "#16a34a" if ok else "#dc2626")

    def _set_status_color(self, key: str, color: str) -> None:
        label = self.status_labels.get(key)
        if label:
            label.configure(fg=color)

    def _check_http(self, url: str, timeout: int = 3) -> bool:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return 200 <= response.status < 500
        except Exception:
            return False


def main() -> None:
    root = tk.Tk()
    DashboardLauncher(root)
    root.mainloop()


if __name__ == "__main__":
    main()