import os
import sys
import pathlib
import pytest
from fastapi.testclient import TestClient

# Configure test database
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

# Ensure the backend package is importable
BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))

from app.main import app  # noqa: E402
from app.database import Base, engine  # noqa: E402


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    db_file = pathlib.Path("test.db")
    if db_file.exists():
        db_file.unlink()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_create_item_default_gst_rate(client):
    response = client.post("/items/", json={"name": "Test Item", "sku": "SKU-1"})
    assert response.status_code == 201
    data = response.json()
    assert data["gst_rate"] == 18
