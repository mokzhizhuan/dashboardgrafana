import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

MAIN_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:126523@postgres:5432/engineering_dashboard",
)

ML_DATABASE_URL = os.getenv(
    "ML_DATABASE_URL",
    "postgresql+psycopg2://postgres:126523@postgres:5432/ml_test_db",
)

main_engine = create_engine(MAIN_DATABASE_URL, echo=True)
MainSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=main_engine,
)
MainBase = declarative_base()

ml_engine = create_engine(ML_DATABASE_URL, echo=True)
MLSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=ml_engine,
)
MLBase = declarative_base()