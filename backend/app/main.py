from fastapi import FastAPI

app = FastAPI(title="SouthEastSociety - Internal Dashboard API")

@app.get("/health")
def health():
    return {"status": "ok"}