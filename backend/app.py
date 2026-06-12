import argparse
import asyncio
import os

import uvicorn
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware

from database import init_db, close_db
from routes import routes
from seed import seed


app = Starlette(
    routes=routes,
    on_startup=[init_db],
    on_shutdown=[close_db],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true", help="Run seed script before starting server")
    parser.add_argument("--port", type=int, default=None, help="Override server port")
    args = parser.parse_args()

    if args.seed:
        asyncio.run(seed())

    port = args.port or int(os.environ.get("PORT", 8009))
    uvicorn.run(app, host="0.0.0.0", port=port)
