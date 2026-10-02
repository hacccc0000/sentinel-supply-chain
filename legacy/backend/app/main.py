import logging
from datetime import datetime, timezone

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_session
from .models import AuditEvent, Build, Integration, Policy, Worker
from .sap import save_secret, test_connection, validate_endpoints
from .schemas import (
    BuildOut,
    BuildIn,
    OverviewOut,
    PolicyIn,
    PolicyOut,
    PolicyPatch,
    SapIntegrationIn,
    SapIntegrationOut,
    SapTestOut,
    WorkerOut,
    WorkerIn,
)
from .security import Principal, get_principal, require_role, workspace_id

logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger(__name__)

DEMO_BUILDS = [
    ("SAP-CORE-2026.10.02", "SAP landscape scanner", "passed", "low", 0, "Baseline scan passed; no critical dependency exposure found."),
    ("supplier-gateway-4.8.1", "Supplier gateway", "quarantined", "critical", 3, "Unsigned dependency and two critical CVEs require review."),
    ("integration-runtime-2.1.0", "Integration runtime", "review", "medium", 1, "One high-severity transitive dependency needs approval."),
    ("warehouse-edge-7.3.2", "Warehouse edge agent", "passed", "low", 0, "Build provenance and policy checks passed."),
]
DEMO_WORKERS = [
    ("sap-prod-eu-scanner", "SAP system scanner", "healthy", "2.8.0"),
    ("supplier-artifact-monitor", "Artifact monitor", "healthy", "1.14.2"),
    ("ci-policy-enforcer", "CI policy enforcer", "degraded", "3.2.1"),
]
DEMO_POLICIES = [
    ("Block critical vulnerabilities", "Critical CVE present", "quarantine", True),
    ("Require signed provenance", "Build provenance missing", "block", True),
    ("Alert on unapproved supplier", "Supplier not allowlisted", "alert", True),
]


app = FastAPI(
    title="SAP Supply Chain Security API",
    version="1.0.0",
    description="Tenant-isolated supply-chain security operations and SAP S/4HANA Cloud OData integration.",
    docs_url=None if get_settings().app_env == "production" else "/docs",
    openapi_url=None if get_settings().app_env == "production" else "/openapi.json",
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Workspace-Mode"],
)


def _scope(request: Request, principal: Principal) -> tuple[str, str]:
    return workspace_id(request, principal)


def _audit(session: Session, scope: str, actor: Principal, action: str, resource_id: str, details: str = "") -> None:
    session.add(AuditEvent(
        workspace_id=scope,
        actor_id=f"{actor.tenant_id}:{actor.object_id}",
        action=action,
        resource_id=resource_id,
        details=details[:1000],
    ))


def _ensure_demo(session: Session, scope: str) -> None:
    if not get_settings().seed_demo_data or not scope.startswith("demo:"):
        return
    if session.bind and session.bind.dialect.name == "postgresql":
        session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:workspace))"), {"workspace": scope})
    if session.scalar(
        select(Build.id).where(Build.workspace_id == scope, Build.name == DEMO_BUILDS[0][0]).limit(1)
    ):
        return
    for name, source, build_status, risk, findings, summary in DEMO_BUILDS:
        session.add(Build(workspace_id=scope, name=name, source=source, status=build_status, risk=risk, findings=findings, summary=summary))
    for name, kind, worker_status, version in DEMO_WORKERS:
        session.add(Worker(workspace_id=scope, name=name, kind=kind, status=worker_status, version=version))
    for name, rule, action, enabled in DEMO_POLICIES:
        session.add(Policy(workspace_id=scope, name=name, rule=rule, action=action, enabled=enabled))
    session.commit()


def _get_build(session: Session, scope: str, build_id: str) -> Build:
    build = session.scalar(select(Build).where(Build.workspace_id == scope, Build.id == build_id))
    if build is None:
        raise HTTPException(status_code=404, detail="Build not found in this workspace")
    return build


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz", include_in_schema=False)
def readyz(session: Session = Depends(get_session)) -> dict[str, str]:
    try:
        session.execute(select(1))
    except Exception as exc:
        logger.exception("Readiness database check failed")
        raise HTTPException(status_code=503, detail="Database is not ready") from exc
    return {"status": "ready"}


@app.get("/api/v1/session")
def get_session_context(
    request: Request,
    principal: Principal = Depends(get_principal),
) -> dict[str, str]:
    _, mode = _scope(request, principal)
    return {
        "display_name": principal.display_name,
        "tenant_id": principal.tenant_id,
        "workspace_mode": mode,
    }


@app.get("/api/v1/overview", response_model=OverviewOut)
def overview(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> OverviewOut:
    scope, _ = _scope(request, principal)
    _ensure_demo(session, scope)
    builds = list(session.scalars(select(Build).where(Build.workspace_id == scope).order_by(Build.created_at.desc())))
    workers = list(session.scalars(select(Worker).where(Worker.workspace_id == scope)))
    return OverviewOut(
        builds=len(builds),
        active_workers=sum(worker.status == "healthy" for worker in workers),
        quarantined=sum(build.status == "quarantined" for build in builds),
        critical_findings=sum(build.findings for build in builds if build.risk == "critical"),
        recent_builds=builds[:5],
    )


@app.get("/api/v1/builds", response_model=list[BuildOut])
def list_builds(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> list[Build]:
    scope, _ = _scope(request, principal)
    _ensure_demo(session, scope)
    return list(session.scalars(select(Build).where(Build.workspace_id == scope).order_by(Build.created_at.desc())))


@app.get("/api/v1/builds/{build_id}", response_model=BuildOut)
def get_build(
    build_id: str,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Build:
    scope, _ = _scope(request, principal)
    _ensure_demo(session, scope)
    return _get_build(session, scope, build_id)


@app.post("/api/v1/builds", response_model=BuildOut, status_code=status.HTTP_201_CREATED)
def create_build(
    payload: BuildIn,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Build:
    require_role(principal, "SupplyChain.Operator")
    scope, mode = _scope(request, principal)
    build = Build(workspace_id=scope, **payload.model_dump())
    session.add(build)
    session.flush()
    _audit(session, scope, principal, f"{mode}.build.ingested", build.id, f"source={payload.source}")
    session.commit()
    session.refresh(build)
    return build


@app.post("/api/v1/builds/{build_id}/release", response_model=BuildOut)
def release_build(
    build_id: str,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Build:
    scope, mode = _scope(request, principal)
    _ensure_demo(session, scope)
    require_role(principal, "SupplyChain.Operator")
    if mode != "demo":
        raise HTTPException(status_code=409, detail="Release is not wired to a production build system; use the authorized CI/CD control plane")
    build = _get_build(session, scope, build_id)
    if build.status != "quarantined":
        raise HTTPException(status_code=409, detail="Only quarantined demo builds can be released")
    build.status = "passed"
    build.risk = "medium"
    build.summary = "Released by an authorized demo operator. This simulation does not change SAP or CI/CD systems."
    _audit(session, scope, principal, "demo.build.released", build.id, "Demo-only state transition")
    session.commit()
    session.refresh(build)
    return build


@app.get("/api/v1/workers", response_model=list[WorkerOut])
def list_workers(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> list[Worker]:
    scope, _ = _scope(request, principal)
    _ensure_demo(session, scope)
    return list(session.scalars(select(Worker).where(Worker.workspace_id == scope).order_by(Worker.name)))


@app.post("/api/v1/workers", response_model=WorkerOut, status_code=status.HTTP_201_CREATED)
def register_worker(
    payload: WorkerIn,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Worker:
    require_role(principal, "SupplyChain.Operator")
    scope, mode = _scope(request, principal)
    worker = Worker(workspace_id=scope, name=payload.name, kind=payload.kind, version=payload.version, status="healthy")
    session.add(worker)
    session.flush()
    _audit(session, scope, principal, f"{mode}.worker.registered", worker.id, f"kind={payload.kind}")
    session.commit()
    session.refresh(worker)
    return worker


@app.post("/api/v1/workers/{worker_id}/heartbeat", response_model=WorkerOut)
def update_worker_heartbeat(
    worker_id: str,
    request: Request,
    payload: WorkerIn,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Worker:
    require_role(principal, "SupplyChain.Operator")
    scope, mode = _scope(request, principal)
    worker = session.scalar(select(Worker).where(Worker.workspace_id == scope, Worker.id == worker_id))
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found in this workspace")
    worker.name = payload.name
    worker.kind = payload.kind
    worker.version = payload.version
    worker.status = "healthy"
    worker.last_seen = datetime.now(timezone.utc)
    _audit(session, scope, principal, f"{mode}.worker.heartbeat", worker.id)
    session.commit()
    session.refresh(worker)
    return worker


@app.get("/api/v1/policies", response_model=list[PolicyOut])
def list_policies(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> list[Policy]:
    scope, _ = _scope(request, principal)
    _ensure_demo(session, scope)
    return list(session.scalars(select(Policy).where(Policy.workspace_id == scope).order_by(Policy.name)))


@app.post("/api/v1/policies", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
def create_policy(
    payload: PolicyIn,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Policy:
    require_role(principal, "SupplyChain.Admin")
    scope, mode = _scope(request, principal)
    _ensure_demo(session, scope)
    policy = Policy(workspace_id=scope, **payload.model_dump())
    session.add(policy)
    session.flush()
    _audit(session, scope, principal, f"{mode}.policy.created", policy.id, "Policy saved; enforcement depends on connected control planes")
    session.commit()
    session.refresh(policy)
    return policy


@app.patch("/api/v1/policies/{policy_id}", response_model=PolicyOut)
def update_policy(
    policy_id: str,
    payload: PolicyPatch,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> Policy:
    require_role(principal, "SupplyChain.Admin")
    scope, mode = _scope(request, principal)
    policy = session.scalar(select(Policy).where(Policy.workspace_id == scope, Policy.id == policy_id))
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found in this workspace")
    policy.enabled = payload.enabled
    _audit(session, scope, principal, f"{mode}.policy.updated", policy.id, f"enabled={payload.enabled}; enforcement depends on connected control planes")
    session.commit()
    session.refresh(policy)
    return policy


@app.get("/api/v1/integrations/sap", response_model=SapIntegrationOut)
def get_sap_integration(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> SapIntegrationOut:
    require_role(principal, "SupplyChain.Admin")
    scope, mode = _scope(request, principal)
    integration = session.scalar(select(Integration).where(Integration.workspace_id == scope))
    if mode == "demo":
        return SapIntegrationOut(configured=True, base_url="https://demo.sap.invalid", api_path="/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product")
    if not integration:
        return SapIntegrationOut(configured=False)
    return SapIntegrationOut(
        configured=True,
        base_url=integration.base_url,
        token_url=integration.token_url,
        client_id=integration.client_id,
        api_path=integration.api_path,
        scopes=integration.scopes,
        auth_method=integration.auth_method,
        connected_at=integration.connected_at,
    )


@app.put("/api/v1/integrations/sap", response_model=SapIntegrationOut)
def save_sap_integration(
    payload: SapIntegrationIn,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> SapIntegrationOut:
    scope, mode = _scope(request, principal)
    if mode != "live":
        raise HTTPException(status_code=409, detail="SAP credentials are never accepted in the demo workspace")
    integration = session.scalar(select(Integration).where(Integration.workspace_id == scope))
    try:
        validate_endpoints(str(payload.base_url), str(payload.token_url))
        if payload.client_secret:
            secret_ref = save_secret(scope, payload.client_secret.get_secret_value())
        elif integration is None or not integration.secret_ref:
            raise HTTPException(status_code=422, detail="An OAuth client secret is required for a new SAP connection")
        else:
            secret_ref = integration.secret_ref
    except (ValueError, RuntimeError, OSError) as exc:
        logger.warning("SAP integration configuration was rejected: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if integration is None:
        integration = Integration(workspace_id=scope, base_url=str(payload.base_url), token_url=str(payload.token_url),
                                  client_id=payload.client_id, api_path=payload.api_path, scopes=payload.scopes,
                                  auth_method=payload.auth_method, secret_ref=secret_ref)
        session.add(integration)
    else:
        integration.base_url = str(payload.base_url)
        integration.token_url = str(payload.token_url)
        integration.client_id = payload.client_id
        integration.api_path = payload.api_path
        integration.scopes = payload.scopes
        integration.auth_method = payload.auth_method
        integration.secret_ref = secret_ref
        integration.connected_at = None
    _audit(session, scope, principal, "sap.integration.configured", "sap-s4hana", "OAuth client secret stored in protected secret storage")
    session.commit()
    return SapIntegrationOut(
        configured=True,
        base_url=integration.base_url,
        token_url=integration.token_url,
        client_id=integration.client_id,
        api_path=integration.api_path,
        scopes=integration.scopes,
        auth_method=integration.auth_method,
        connected_at=integration.connected_at,
    )


@app.post("/api/v1/integrations/sap/test", response_model=SapTestOut)
async def test_sap_integration(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> SapTestOut:
    require_role(principal, "SupplyChain.Admin")
    scope, mode = _scope(request, principal)
    if mode == "demo":
        return SapTestOut(
            connected=True,
            http_status=200,
            sap_service="Demo simulation",
            records_returned=3,
            checked_at=datetime.now(timezone.utc),
            message="Demo only: no SAP tenant was contacted.",
        )
    integration = session.scalar(select(Integration).where(Integration.workspace_id == scope))
    if not integration:
        raise HTTPException(status_code=404, detail="Configure an SAP integration before testing it")
    try:
        return SapTestOut(**(await test_connection(integration, session)))
    except (httpx.HTTPError, RuntimeError, ValueError, OSError) as exc:
        logger.warning("SAP connection test failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/audit")
def list_audit_events(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: Session = Depends(get_session),
) -> list[dict]:
    scope, _ = _scope(request, principal)
    events = session.scalars(
        select(AuditEvent).where(AuditEvent.workspace_id == scope).order_by(AuditEvent.created_at.desc()).limit(100)
    )
    return [
        {"id": item.id, "actor_id": item.actor_id, "action": item.action, "resource_id": item.resource_id,
         "created_at": item.created_at, "details": item.details}
        for item in events
    ]


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> Response:
    logger.exception("Unhandled application error", exc_info=exc)
    return Response(
        content='{"detail":"An unexpected server error occurred"}',
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        media_type="application/json",
    )
