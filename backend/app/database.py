from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    id_card = Column(String(18), unique=True, index=True, nullable=False)
    phone = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_date = Column(DateTime, nullable=False)
    department = Column(String(100))
    doctor_name = Column(String(100))
    status = Column(String(50), default="confirmed")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    visit_date = Column(DateTime, nullable=False)
    triage_nurse = Column(String(100))
    department = Column(String(100))
    diagnosis = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    appointment = relationship("Appointment")


class FollowUpVisit(Base):
    __tablename__ = "follow_up_visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    follow_up_date = Column(DateTime, nullable=False)
    follow_up_type = Column(String(50))
    content = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    visit = relationship("Visit")


class FollowUpRecord(Base):
    __tablename__ = "follow_up_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    visit_id = Column(Integer, ForeignKey("visits.id"))
    follow_up_visit_id = Column(Integer, ForeignKey("follow_up_visits.id"))

    status = Column(String(50), nullable=False, default="draft")
    version = Column(Integer, default=1)

    follow_up_type = Column(String(50))
    content = Column(Text)
    result = Column(Text)
    remarks = Column(Text)

    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String(100))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor_opinion = Column(Text)
    doctor_verified = Column(Boolean, default=False)
    doctor_verified_at = Column(DateTime)

    director_opinion = Column(Text)
    director_verified = Column(Boolean, default=False)
    director_verified_at = Column(DateTime)

    patient = relationship("Patient")
    appointment = relationship("Appointment")
    visit = relationship("Visit")
    follow_up_visit_obj = relationship("FollowUpVisit", foreign_keys=[follow_up_visit_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("follow_up_records.id"))
    action = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=False)
    operator_role = Column(String(50))
    from_status = Column(String(50))
    to_status = Column(String(50))
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
