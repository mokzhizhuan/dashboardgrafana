from datetime import datetime


def iso_now(dt: datetime) -> str:
    return dt.isoformat(sep=" ", timespec="seconds")
