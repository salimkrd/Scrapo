import logging
import sys
from backend.app.core.config import settings


def setup_logging():
    log_level = logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO

    # Structured format without exposing sensitive tokens or passwords
    format_str = "%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s"

    logging.basicConfig(
        level=log_level,
        format=format_str,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Silence overly verbose external loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


logger = logging.getLogger("scrapo")
