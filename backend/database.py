import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

MAIN_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:126523@postgres:5432/engineering_dashboard",
)

AUTH_DATABASE_URL = os.getenv(
    "AUTH_DATABASE_URL",
    "postgresql+psycopg2://postgres:126523@postgres:5432/auth_db",
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

auth_engine = create_engine(AUTH_DATABASE_URL, echo=True)
AuthSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=auth_engine,
)
AuthBase = declarative_base()

ml_engine = create_engine(ML_DATABASE_URL, echo=True)
MLSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=ml_engine,
)
MLBase = declarative_base()


def get_main_db():
    db = MainSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_auth_db():
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_ml_db():
    db = MLSessionLocal()
    try:
        yield db
    finally:
        db.close()
