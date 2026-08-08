import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from blogresearch.config.registrations import resolve_presenter
from shared import environment as env
from shared.api_view import ApiView

env.load()

frontend_origins = [
    origin.strip()
    for origin in os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(title="BlogResearch API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AskResponse(BaseModel):
    result: str
    error: str


@app.get("/")
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ask", response_model=AskResponse)
def ask() -> AskResponse:
    view = ApiView()
    presenter = resolve_presenter(view)
    presenter.on_button_click()

    return AskResponse(
        result=view.view_model.result,
        error=view.view_model.error,
    )
