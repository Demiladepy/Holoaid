from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_healthcheck():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "timestamp" in payload
