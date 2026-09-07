from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI(title="ai-research-blog")

_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ai-research-blog</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5;">
  <h1>ai-research-blog</h1>
  <p>Hello, world. The pipeline is live.</p>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return _PAGE


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
