import datetime
import os
import secrets

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from blogresearch.config.registrations import resolve_presenter
from shared import environment as env
from shared.api_view import ApiView
from shared.repositories.oxigraph_triple_repository import OxigraphTripleRepository

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


# --- TEMPORARY: Railway-volume persistence check ---
#
# Answers one open question (see artifacts/rdf-poc/FINDINGS.md):
# does data written to an OxigraphTripleRepository at the Railway
# volume's mount path actually survive a restart, not just a fresh
# Store object in the same local process (already proven locally)?
#
# Inert by default - returns 404 unless DEBUG_OXIGRAPH_VOLUME_CHECK is
# set on Railway, so this has no effect on the live app until
# deliberately enabled for the duration of the test. Remove this
# whole block once the question is answered.
_VOLUME_CHECK_PATH = "/var/lib/agraph/oxigraph_poc_check"
_VOLUME_CHECK_SUBJECT = "railway-volume-check"
_VOLUME_CHECK_PREDICATE = "last-write"


@app.get("/api/_debug/oxigraph-volume-check")
def oxigraph_volume_check() -> dict[str, str | None]:
    if not os.environ.get("DEBUG_OXIGRAPH_VOLUME_CHECK"):
        raise HTTPException(status_code=404, detail="Not Found")

    repository = OxigraphTripleRepository(store_path=_VOLUME_CHECK_PATH)
    previous = repository.read(_VOLUME_CHECK_SUBJECT, _VOLUME_CHECK_PREDICATE)
    new_value = (
        f"{datetime.datetime.now(datetime.timezone.utc).isoformat()}"
        f"-{secrets.token_hex(4)}"
    )
    if previous is None:
        repository.create(_VOLUME_CHECK_SUBJECT, _VOLUME_CHECK_PREDICATE, new_value)
    else:
        repository.update(_VOLUME_CHECK_SUBJECT, _VOLUME_CHECK_PREDICATE, new_value)
    del repository  # release the on-disk lock before this request ends

    return {
        "store_path": _VOLUME_CHECK_PATH,
        "previous_value": previous.object_value if previous else None,
        "new_value": new_value,
    }
