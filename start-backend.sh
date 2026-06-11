#!/bin/bash
set -e

cd "$(dirname "$0")/backend"

if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

cargo run
