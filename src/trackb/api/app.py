from fastapi import FastAPI

from trackb.api.routes import router


def create_app() -> FastAPI:
    app = FastAPI(title="Track B: Agent Builder API")
    app.include_router(router)
    return app


app = create_app()
