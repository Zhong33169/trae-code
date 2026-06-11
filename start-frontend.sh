#!/bin/bash
set -e

cd "$(dirname "$0")/frontend"

if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

npm run dev
