#!/usr/bin/env python3
import os
import sys

from uvicorn import run

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8003"))
    host = os.environ.get("BACKEND_HOST", "0.0.0.0")
    print(f"Starting backend on {host}:{port}")
    print(f"CORS origins: {os.environ.get('CORS_ORIGINS', 'http://localhost:3003,http://127.0.0.1:3003')}")
    run("app.main:app", host=host, port=port, reload=True)
