#!/bin/bash
cd /Users/echo/Desktop/zqzl/zhong33169/trae-code-1/backend

for pid in $(lsof -ti:8001 2>/dev/null); do
  kill -9 $pid 2>/dev/null
done
echo "Old processes stopped"

rm -f subcontract.db
echo "DB removed"

./subcontract-server &
sleep 2
echo "Server started"
