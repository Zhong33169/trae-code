from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from database import get_db
from deps import allow_all_authenticated, allow_registrar_supervisor
from models.user import User
from models.charging_pile import ChargingPile
from schemas.charging_pile import ChargingPileCreate, ChargingPileResponse

router = APIRouter()


async def init_test_charging_piles(db: AsyncSession):
    test_piles = [
        {
            "pile_code": "CP001",
            "pile_name": "1号直流快充桩",
            "station_code": "ST001",
            "station_name": "新能源汽车总站",
            "location": "A区-01车位",
            "power_rating": "120kW",
            "qr_code": "CP-ST001-001-2024-A01"
        },
        {
            "pile_code": "CP002",
            "pile_name": "2号直流快充桩",
            "station_code": "ST001",
            "station_name": "新能源汽车总站",
            "location": "A区-02车位",
            "power_rating": "120kW",
            "qr_code": "CP-ST001-002-2024-A02"
        },
        {
            "pile_code": "CP003",
            "pile_name": "3号交流慢充桩",
            "station_code": "ST001",
            "station_name": "新能源汽车总站",
            "location": "B区-01车位",
            "power_rating": "7kW",
            "qr_code": "CP-ST001-003-2024-B01"
        },
        {
            "pile_code": "CP004",
            "pile_name": "4号交流慢充桩",
            "station_code": "ST001",
            "station_name": "新能源汽车总站",
            "location": "B区-02车位",
            "power_rating": "7kW",
            "qr_code": "CP-ST001-004-2024-B02"
        },
        {
            "pile_code": "CP005",
            "pile_name": "5号超充桩",
            "station_code": "ST001",
            "station_name": "新能源汽车总站",
            "location": "C区-01车位",
            "power_rating": "250kW",
            "qr_code": "CP-ST001-005-2024-C01"
        },
        {
            "pile_code": "CP006",
            "pile_name": "6号超充桩",
            "station_code": "ST001",
            "station_name": "新能源汽车总站",
            "location": "C区-02车位",
            "power_rating": "250kW",
            "qr_code": "CP-ST001-006-2024-C02"
        }
    ]

    for pile_data in test_piles:
        result = await db.execute(
            select(ChargingPile).where(ChargingPile.qr_code == pile_data["qr_code"])
        )
        existing_pile = result.scalar_one_or_none()
        if not existing_pile:
            pile = ChargingPile(**pile_data)
            db.add(pile)

    await db.commit()


@router.get("", response_model=dict, summary="获取充电桩列表", description="获取充电桩列表，支持分页和筛选")
async def get_charging_piles(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    station_code: Optional[str] = Query(None, description="充电站编码"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    await init_test_charging_piles(db)

    query = select(ChargingPile)

    if station_code:
        query = query.where(ChargingPile.station_code == station_code)
    if is_active is not None:
        query = query.where(ChargingPile.is_active == is_active)
    if keyword:
        query = query.where(
            (ChargingPile.pile_name.like(f"%{keyword}%")) |
            (ChargingPile.pile_code.like(f"%{keyword}%")) |
            (ChargingPile.location.like(f"%{keyword}%"))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(ChargingPile.id).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    piles = result.scalars().all()

    return {
        "total": total,
        "items": [
            ChargingPileResponse.model_validate(pile)
            for pile in piles
        ],
        "page": page,
        "page_size": page_size
    }


@router.get("/{pile_id}", response_model=ChargingPileResponse, summary="获取充电桩详情", description="根据ID获取充电桩详细信息")
async def get_charging_pile(
    pile_id: int,
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChargingPile).where(ChargingPile.id == pile_id)
    )
    pile = result.scalar_one_or_none()

    if not pile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"充电桩ID {pile_id} 不存在"
        )

    return ChargingPileResponse.model_validate(pile)


@router.post("", response_model=ChargingPileResponse, summary="新增充电桩", description="创建新的充电桩记录")
async def create_charging_pile(
    pile_data: ChargingPileCreate,
    current_user: User = Depends(allow_registrar_supervisor),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChargingPile).where(
            (ChargingPile.pile_code == pile_data.pile_code) |
            (ChargingPile.qr_code == pile_data.qr_code)
        )
    )
    existing_pile = result.scalar_one_or_none()
    if existing_pile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="充电桩编码或二维码已存在"
        )

    pile = ChargingPile(**pile_data.model_dump())
    db.add(pile)
    await db.commit()
    await db.refresh(pile)

    return ChargingPileResponse.model_validate(pile)


@router.put("/{pile_id}", response_model=ChargingPileResponse, summary="更新充电桩", description="更新充电桩信息")
async def update_charging_pile(
    pile_id: int,
    pile_data: ChargingPileCreate,
    current_user: User = Depends(allow_registrar_supervisor),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChargingPile).where(ChargingPile.id == pile_id)
    )
    pile = result.scalar_one_or_none()

    if not pile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"充电桩ID {pile_id} 不存在"
        )

    result = await db.execute(
        select(ChargingPile).where(
            ((ChargingPile.pile_code == pile_data.pile_code) |
             (ChargingPile.qr_code == pile_data.qr_code)) &
            (ChargingPile.id != pile_id)
        )
    )
    existing_pile = result.scalar_one_or_none()
    if existing_pile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="充电桩编码或二维码已存在"
        )

    for field, value in pile_data.model_dump().items():
        setattr(pile, field, value)

    await db.commit()
    await db.refresh(pile)

    return ChargingPileResponse.model_validate(pile)
