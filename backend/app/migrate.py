import logging

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from .database import engine

logger = logging.getLogger(__name__)
LOCK_ID = 0x5341505343


def main() -> None:
    config = Config("alembic.ini")
    with engine.connect() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": LOCK_ID})
            connection.commit()
        config.attributes["connection"] = connection
        try:
            command.upgrade(config, "head")
        finally:
            if connection.dialect.name == "postgresql":
                connection.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": LOCK_ID})
            connection.commit()
    logger.info("Database schema migration completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
