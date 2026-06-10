import asyncio
import uuid
from typing import Dict, Tuple, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

_locks: Dict[int, asyncio.Lock] = {}
_request_ids: set = set()


def generate_request_id() -> str:
    return str(uuid.uuid4())


async def acquire_lock(resource_id: int, timeout: float = 5.0) -> Tuple[bool, Optional[str]]:
    if resource_id not in _locks:
        _locks[resource_id] = asyncio.Lock()

    lock = _locks[resource_id]
    try:
        acquired = await asyncio.wait_for(lock.acquire(), timeout=timeout)
        if not acquired:
            return False, "获取锁超时，请稍后重试"
        return True, None
    except asyncio.TimeoutError:
        return False, "系统繁忙，资源被占用，请稍后重试"


def release_lock(resource_id: int) -> None:
    if resource_id in _locks:
        lock = _locks[resource_id]
        if lock.locked():
            lock.release()


def check_version(current_version: int, expected_version: int, order_no: str) -> None:
    if current_version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"巡检单 [{order_no}] 已被其他操作修改，请刷新页面后重试"
        )


def check_idempotency(request_id: Optional[str]) -> None:
    if request_id and request_id in _request_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="重复请求，请不要重复提交"
        )
    if request_id:
        _request_ids.add(request_id)
