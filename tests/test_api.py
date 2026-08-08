from fastapi.testclient import TestClient

from app import app, ask


def test_root_endpoint_returns_a_success_response():
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ask_endpoint_uses_the_configured_provider(monkeypatch):
    monkeypatch.setenv("PROVIDER_NAME", "dci")
    monkeypatch.setenv("USE_CUSTOM_PRESENTER", "false")

    response = ask()

    assert response.error == ""
    assert response.result