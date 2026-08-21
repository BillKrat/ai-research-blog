import os
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from blogresearch.config.registrations import resolve_presenter, resolve_user_profile_presenter
from blogresearch.presenters.user_profile_presenter import UserProfilePresenter
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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
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


# --- User profile CRUDL ---
#
# Deliberately no /api/users/{user_id}/undo route: UserProfilePresenter.
# on_undo() (blogresearch/presenters/user_profile_presenter.py) resets a
# ViewModel's row to its last-loaded snapshot, held in that one Python
# object's memory - but each route handler here resolves a brand-new
# presenter per call (resolve_user_profile_presenter(), no session
# store), so a second HTTP request has no way to reach the same
# presenter instance an "undo" would need to act on. Undo is real and
# fully tested at the ViewModel/Presenter level (see
# tests/test_user_profile_view_model.py and
# tests/test_user_profile_presenter.py) - it just isn't wired to an
# endpoint yet, because doing so today would either silently do nothing
# or require inventing session infrastructure this project hasn't
# decided on. The more likely real answer, once the frontend exists
# (Step 6): the browser already holds the in-progress edit in its own
# state before a save request is ever sent, so "undo" may turn out to
# be purely a frontend concern (revert local state, no backend round
# trip) rather than needing a backend endpoint at all - an open
# question for that step, flagged here rather than guessed at now.


class ColumnOut(BaseModel):
    name: str
    label: str
    sequence: int
    type: str
    length: int | None = None


class UserProfileResponse(BaseModel):
    columns: list[ColumnOut]
    row: dict[str, Any]
    error: str


class UserWriteRequest(BaseModel):
    name: str
    email: str


def _user_profile_response(presenter: UserProfilePresenter) -> UserProfileResponse:
    view_model = presenter.view_model
    return UserProfileResponse(
        columns=[ColumnOut(**asdict(column)) for column in view_model.columns],
        row=view_model.row,
        error=view_model.error,
    )


@app.get("/api/users/{user_id}", response_model=UserProfileResponse)
def get_user(user_id: str) -> UserProfileResponse:
    presenter = resolve_user_profile_presenter()
    presenter.on_load(user_id)
    return _user_profile_response(presenter)


@app.post("/api/users", response_model=UserProfileResponse)
def create_user(request: UserWriteRequest) -> UserProfileResponse:
    presenter = resolve_user_profile_presenter()
    presenter.on_add(request.name, request.email)
    return _user_profile_response(presenter)


@app.put("/api/users/{user_id}", response_model=UserProfileResponse)
def update_user(user_id: str, request: UserWriteRequest) -> UserProfileResponse:
    presenter = resolve_user_profile_presenter()
    presenter.on_edit(user_id, request.name, request.email)
    return _user_profile_response(presenter)


@app.delete("/api/users/{user_id}", response_model=UserProfileResponse)
def delete_user(user_id: str) -> UserProfileResponse:
    presenter = resolve_user_profile_presenter()
    presenter.on_delete(user_id)
    return _user_profile_response(presenter)
