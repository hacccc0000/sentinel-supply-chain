import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_session
from app.main import app
from app.security import Principal, require_role, workspace_id

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=test_engine)

    def override_session():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_demo_data_is_seeded_and_live_workspace_is_separate(client):
    demo = client.get("/api/v1/builds", headers={"X-Workspace-Mode": "demo"})
    live = client.get("/api/v1/builds", headers={"X-Workspace-Mode": "live"})

    assert demo.status_code == 200
    assert len(demo.json()) == 4
    assert live.status_code == 200
    assert live.json() == []


def test_demo_release_is_persisted_without_changing_live_workspace(client):
    headers = {"X-Workspace-Mode": "demo"}
    builds = client.get("/api/v1/builds", headers=headers).json()
    quarantined = next(build for build in builds if build["status"] == "quarantined")

    released = client.post(f"/api/v1/builds/{quarantined['id']}/release", headers=headers)
    live = client.get("/api/v1/builds", headers={"X-Workspace-Mode": "live"})

    assert released.status_code == 200
    assert released.json()["status"] == "passed"
    assert live.json() == []


def test_sap_secrets_cannot_be_saved_in_demo_workspace(client):
    response = client.put(
        "/api/v1/integrations/sap",
        headers={"X-Workspace-Mode": "demo"},
        json={
            "base_url": "https://example.sap.com",
            "token_url": "https://example.sap.com/oauth/token",
            "client_id": "test-client",
            "client_secret": "do-not-store",
            "api_path": "/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product",
        },
    )

    assert response.status_code == 409


def test_invalid_workspace_mode_is_rejected(client):
    response = client.get("/api/v1/builds", headers={"X-Workspace-Mode": "customer"})

    assert response.status_code == 400


def test_role_hierarchy_blocks_unprivileged_operations():
    reader = Principal("tenant-a", "user-1", "Reader", frozenset({"SupplyChain.Reader"}))

    with pytest.raises(HTTPException) as error:
        require_role(reader, "SupplyChain.Admin")

    assert getattr(error.value, "status_code", None) == 403


def test_live_workspace_is_shared_per_tenant_but_demo_is_user_isolated():
    first_request = type("Request", (), {"headers": {"x-workspace-mode": "live"}})()
    second_request = type("Request", (), {"headers": {"x-workspace-mode": "demo"}})()
    first = Principal("tenant-a", "user-1", "User 1", frozenset({"SupplyChain.Reader"}))
    second = Principal("tenant-a", "user-2", "User 2", frozenset({"SupplyChain.Reader"}))

    assert workspace_id(first_request, first)[0] == workspace_id(first_request, second)[0]
    assert workspace_id(second_request, first)[0] != workspace_id(second_request, second)[0]


def test_live_build_ingestion_persists_only_in_the_live_workspace(client):
    created = client.post(
        "/api/v1/builds",
        headers={"X-Workspace-Mode": "live"},
        json={
            "name": "sap-adapter-1.2.0",
            "source": "CI pipeline",
            "status": "review",
            "risk": "medium",
            "findings": 2,
            "summary": "Needs review",
        },
    )
    live = client.get("/api/v1/builds", headers={"X-Workspace-Mode": "live"})
    demo = client.get("/api/v1/builds", headers={"X-Workspace-Mode": "demo"})

    assert created.status_code == 201
    assert len(live.json()) == 1
    assert live.json()[0]["name"] == "sap-adapter-1.2.0"
    assert len(demo.json()) == 4


def test_live_worker_and_policy_changes_are_persisted_and_audited(client):
    headers = {"X-Workspace-Mode": "live"}
    worker = client.post(
        "/api/v1/workers",
        headers=headers,
        json={"name": "eu-s4-scanner-1", "kind": "SAP scanner", "version": "1.0.0"},
    )
    policy = client.post(
        "/api/v1/policies",
        headers=headers,
        json={"name": "Require signed builds", "rule": "Build provenance missing", "action": "block"},
    )
    audit = client.get("/api/v1/audit", headers=headers)

    assert worker.status_code == 201
    assert policy.status_code == 201
    assert {event["action"] for event in audit.json()} == {"live.worker.registered", "live.policy.created"}


def test_health_and_readiness_endpoints(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"status": "ready"}
