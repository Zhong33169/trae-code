from datetime import datetime
from sqlalchemy.orm import Session
from app.models.database import User, RoleEnum
from app.models.db_config import init_db, engine
from sqlalchemy import text


DEMO_USERS = [
    {"username": "fqr", "display_name": "冯庆荣", "role": RoleEnum.INITIATOR},
    {"username": "bl", "display_name": "办理员", "role": RoleEnum.HANDLER},
    {"username": "fhr", "display_name": "复核人", "role": RoleEnum.REVIEWER},
]

SAMPLE_ORDERS = [
    {"customer": "华盛物流", "cargo_name": "电子元件", "cargo_weight": 12.5, "origin": "深圳宝安", "destination": "广州白云"},
    {"customer": "顺丰快运", "cargo_name": "服装面料", "cargo_weight": 8.0, "origin": "上海浦东", "destination": "杭州余杭"},
    {"customer": "德邦物流", "cargo_name": "机械设备", "cargo_weight": 45.2, "origin": "北京朝阳", "destination": "天津滨海"},
    {"customer": "中通物流", "cargo_name": "食品饮料", "cargo_weight": 22.3, "origin": "成都武侯", "destination": "重庆江北"},
    {"customer": "圆通速递", "cargo_name": "日用百货", "cargo_weight": 5.7, "origin": "南京鼓楼", "destination": "苏州工业园"},
    {"customer": "韵达快递", "cargo_name": "图书教材", "cargo_weight": 3.2, "origin": "武汉武昌", "destination": "长沙岳麓"},
    {"customer": "极兔速递", "cargo_name": "生鲜水果", "cargo_weight": 18.9, "origin": "西安雁塔", "destination": "郑州金水"},
    {"customer": "EMS邮政", "cargo_name": "文件包裹", "cargo_weight": 1.5, "origin": "济南历下", "destination": "青岛崂山"},
]


def seed_data(db: Session):
    for u in DEMO_USERS:
        existing = db.query(User).filter(User.username == u["username"]).first()
        if not existing:
            user = User(**u)
            db.add(user)
    db.commit()


def reset_and_seed():
    init_db()
    from app.models.db_config import SessionLocal
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
