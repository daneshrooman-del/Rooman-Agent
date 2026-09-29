from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from trackb.api.routes import router
from trackb.config import get_settings


def create_app() -> FastAPI:
    app = FastAPI(title="Track B: Agent Builder API")
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(router)
    return app


app = create_app()
