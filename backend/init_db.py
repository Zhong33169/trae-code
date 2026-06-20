import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal
from app.models import (
    Base, User, Role, BillStatus, ProcessNode,
    EnergyBill, NodeTimeoutConfig, OperationLog
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def init_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _init_node_configs(db)
        _init_users(db)
        _init_sample_bills(db)
        db.commit()
        print("数据库初始化完成！")
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


def _init_node_configs(db: Session):
    configs = [
        {"node": ProcessNode.REGISTRATION, "timeout_hours": 24, "description": "登记员录入/补正节点，超时24小时"},
        {"node": ProcessNode.AUDIT, "timeout_hours": 48, "description": "审核主管办理节点，超时48小时"},
        {"node": ProcessNode.REVIEW, "timeout_hours": 24, "description": "物业复核归档节点，超时24小时"},
    ]
    for cfg in configs:
        existing = db.query(NodeTimeoutConfig).filter_by(node=cfg["node"]).first()
        if not existing:
            db.add(NodeTimeoutConfig(**cfg))


def _init_users(db: Session):
    users = [
        {
            "username": "registrar",
            "password": "123456",
            "real_name": "张登记",
            "role": Role.REGISTRAR
        },
        {
            "username": "auditor",
            "password": "123456",
            "real_name": "李审核",
            "role": Role.AUDITOR
        },
        {
            "username": "property",
            "password": "123456",
            "real_name": "王物业",
            "role": Role.PROPERTY
        },
    ]
    for user_data in users:
        existing = db.query(User).filter_by(username=user_data["username"]).first()
        if not existing:
            password_hash = pwd_context.hash(user_data.pop("password"))
            user = User(**user_data, password_hash=password_hash)
            db.add(user)


def _init_sample_bills(db: Session):
    registrar = db.query(User).filter_by(role=Role.REGISTRAR).first()
    if not registrar:
        return

    now = datetime.utcnow()
    sample_data = [
        {
            "bill_no": "EB-2026-06-001",
            "period": "2026-06",
            "park_name": "产业园A区",
            "building": "1号楼",
            "room": "101",
            "electricity_usage": 1200.5,
            "water_usage": 85.2,
            "gas_usage": 120.0,
            "electricity_amount": 960.40,
            "water_amount": 426.00,
            "gas_amount": 360.00,
            "total_amount": 1746.40,
            "status": BillStatus.PENDING_AUDIT,
            "current_node": ProcessNode.AUDIT,
            "current_responsible_role": Role.AUDITOR,
            "current_node_started_at": now - timedelta(hours=30),
            "has_meter_reading": True,
            "has_bill_generated": True,
            "is_overdue": True,
            "overdue_hours": 30.0,
            "created_by": registrar.id,
        },
        {
            "bill_no": "EB-2026-06-002",
            "period": "2026-06",
            "park_name": "产业园A区",
            "building": "1号楼",
            "room": "102",
            "electricity_usage": 800.0,
            "water_usage": 50.0,
            "gas_usage": 60.0,
            "electricity_amount": 640.00,
            "water_amount": 250.00,
            "gas_amount": 180.00,
            "total_amount": 1070.00,
            "status": BillStatus.DRAFT,
            "current_node": ProcessNode.REGISTRATION,
            "current_responsible_role": Role.REGISTRAR,
            "current_node_started_at": now,
            "has_meter_reading": False,
            "has_bill_generated": False,
            "created_by": registrar.id,
        },
        {
            "bill_no": "EB-2026-06-003",
            "period": "2026-06",
            "park_name": "产业园B区",
            "building": "2号楼",
            "room": "201",
            "electricity_usage": 2000.0,
            "water_usage": 150.0,
            "gas_usage": 200.0,
            "electricity_amount": 1600.00,
            "water_amount": 750.00,
            "gas_amount": 600.00,
            "total_amount": 2950.00,
            "status": BillStatus.AUDITED,
            "current_node": ProcessNode.REVIEW,
            "current_responsible_role": Role.PROPERTY,
            "current_node_started_at": now - timedelta(hours=10),
            "has_meter_reading": True,
            "has_bill_generated": True,
            "has_payment_verified": True,
            "created_by": registrar.id,
        },
        {
            "bill_no": "EB-2026-06-004",
            "period": "2026-06",
            "park_name": "产业园A区",
            "building": "1号楼",
            "room": "103",
            "electricity_usage": 500.0,
            "water_usage": 30.0,
            "gas_usage": 40.0,
            "electricity_amount": 400.00,
            "water_amount": 150.00,
            "gas_amount": 120.00,
            "total_amount": 670.00,
            "status": BillStatus.REJECTED,
            "current_node": ProcessNode.REGISTRATION,
            "current_responsible_role": Role.REGISTRAR,
            "current_node_started_at": now - timedelta(hours=5),
            "has_meter_reading": True,
            "has_bill_generated": True,
            "created_by": registrar.id,
        },
        {
            "bill_no": "EB-2026-05-001",
            "period": "2026-05",
            "park_name": "产业园A区",
            "building": "1号楼",
            "room": "101",
            "electricity_usage": 1100.0,
            "water_usage": 80.0,
            "gas_usage": 110.0,
            "electricity_amount": 880.00,
            "water_amount": 400.00,
            "gas_amount": 330.00,
            "total_amount": 1610.00,
            "status": BillStatus.ARCHIVED,
            "current_node": ProcessNode.COMPLETED,
            "current_responsible_role": Role.PROPERTY,
            "current_node_started_at": now - timedelta(days=10),
            "has_meter_reading": True,
            "has_bill_generated": True,
            "has_payment_verified": True,
            "created_by": registrar.id,
        },
    ]

    for data in sample_data:
        existing = db.query(EnergyBill).filter_by(bill_no=data["bill_no"]).first()
        if not existing:
            bill = EnergyBill(**data)
            db.add(bill)
            db.flush()

            log = OperationLog(
                bill_id=bill.id,
                operator_id=registrar.id,
                operation="创建账单",
                to_status=bill.status,
                to_node=bill.current_node,
                remark="系统初始化样例数据"
            )
            db.add(log)


if __name__ == "__main__":
    init_database()
