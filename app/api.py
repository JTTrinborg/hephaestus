import os
import secrets
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from app.graph import graph

#### THIS FILE IS FOR THE CONNECTION USING FASTAPI ############

app = FastAPI(title="Hephaestus")


class RunRequest(BaseModel):
    alert_text: str

class RunResponse(BaseModel):
    report: str
    new_jobs: int


def check_key(x_api_key: str) -> None:
    """Reject the call unless the header matches FASTAPI_KEY in .env."""
    expected = os.getenv("FASTAPI_KEY")
    if not expected or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/run", response_model=RunResponse)
def run(req: RunRequest, x_api_key: str = Header()):
    check_key(x_api_key)
    result = graph.invoke({"alert_text": req.alert_text})
    return RunResponse(report=result["report"], new_jobs=len(result["jobs"]))