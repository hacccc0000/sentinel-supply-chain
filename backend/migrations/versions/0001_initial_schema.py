"""Initial tenant-isolated supply-chain schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "builds",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("workspace_id", sa.String(length=160), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("source", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("risk", sa.String(length=24), nullable=False),
        sa.Column("findings", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
    )
    op.create_index("ix_builds_workspace_created", "builds", ["workspace_id", "created_at"])

    op.create_table(
        "workers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("workspace_id", sa.String(length=160), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.String(length=64), nullable=False),
    )
    op.create_index("ix_workers_workspace_name", "workers", ["workspace_id", "name"])

    op.create_table(
        "policies",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("workspace_id", sa.String(length=160), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("rule", sa.String(length=240), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_policies_workspace", "policies", ["workspace_id"])

    op.create_table(
        "integrations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("workspace_id", sa.String(length=160), nullable=False, unique=True),
        sa.Column("base_url", sa.String(length=512), nullable=False),
        sa.Column("token_url", sa.String(length=512), nullable=False),
        sa.Column("client_id", sa.String(length=256), nullable=False),
        sa.Column("api_path", sa.String(length=512), nullable=False),
        sa.Column("scopes", sa.String(length=512), nullable=False),
        sa.Column("auth_method", sa.String(length=32), nullable=False),
        sa.Column("secret_ref", sa.String(length=256), nullable=True),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_integrations_workspace", "integrations", ["workspace_id"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("workspace_id", sa.String(length=160), nullable=False),
        sa.Column("actor_id", sa.String(length=256), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("resource_id", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
    )
    op.create_index("ix_audit_workspace_created", "audit_events", ["workspace_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_workspace_created", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_integrations_workspace", table_name="integrations")
    op.drop_table("integrations")
    op.drop_index("ix_policies_workspace", table_name="policies")
    op.drop_table("policies")
    op.drop_index("ix_workers_workspace_name", table_name="workers")
    op.drop_table("workers")
    op.drop_index("ix_builds_workspace_created", table_name="builds")
    op.drop_table("builds")
