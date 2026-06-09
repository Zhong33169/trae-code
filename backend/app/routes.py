from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from sqlalchemy.orm import Session
import json

from .database import get_db
from .schemas import (
    FollowUpRecordCreate, FollowUpRecordUpdate,
    FollowUpRecordOut, FollowUpRecordListOut,
    ProcessRecordRequest, BatchOperationRequest,
    PatientOut, AppointmentOut, VisitOut, FollowUpVisitOut,
)
from .services import (
    list_records, get_record_detail, create_record, update_record,
    submit_record, reject_record, process_record,
    batch_process, batch_reject,
    list_patients, list_evidence_for_patient, get_current_user,
)
from .validators import ValidationError
from .config import ROLE_PERMISSIONS


def error_response(exc: ValidationError, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.error_code,
            "field": exc.field,
        }
    )


def get_current_role(request: Request) -> str:
    return request.headers.get("X-User-Role", "")


def get_current_username(request: Request) -> str:
    return request.headers.get("X-User-Name", "")


async def list_records_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        role = get_current_role(request)
        if not role:
            return JSONResponse(
                status_code=401,
                content={"detail": "未指定角色", "error_code": "NO_ROLE"}
            )

        status = request.query_params.get("status")
        patient_name = request.query_params.get("patient_name")
        skip = int(request.query_params.get("skip", 0))
        limit = int(request.query_params.get("limit", 20))

        total, items = list_records(db, role, status, patient_name, skip, limit)

        result = {
            "total": total,
            "items": [FollowUpRecordOut.model_validate(item).model_dump(mode="json") for item in items],
        }
        return JSONResponse(result)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def get_record_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        record_id = int(request.path_params["record_id"])
        record = get_record_detail(db, record_id)
        if not record:
            return JSONResponse(
                status_code=404,
                content={"detail": "记录不存在", "error_code": "RECORD_NOT_FOUND"}
            )
        result = FollowUpRecordOut.model_validate(record).model_dump(mode="json")
        return JSONResponse(result)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def create_record_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        body = await request.json()
        data = FollowUpRecordCreate(**body)
        role = get_current_role(request)
        username = get_current_username(request)

        record = create_record(db, data, username, role)
        result = FollowUpRecordOut.model_validate(record).model_dump(mode="json")
        return JSONResponse(result, status_code=201)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def update_record_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        record_id = int(request.path_params["record_id"])
        body = await request.json()
        data = FollowUpRecordUpdate(**body)
        role = get_current_role(request)
        username = get_current_username(request)

        record = update_record(db, record_id, data, username, role)
        result = FollowUpRecordOut.model_validate(record).model_dump(mode="json")
        return JSONResponse(result)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def submit_record_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        record_id = int(request.path_params["record_id"])
        body = await request.json()
        version = body.get("version", 0)
        role = get_current_role(request)
        username = get_current_username(request)

        record = submit_record(db, record_id, version, username, role)
        result = FollowUpRecordOut.model_validate(record).model_dump(mode="json")
        return JSONResponse(result)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def reject_record_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        record_id = int(request.path_params["record_id"])
        body = await request.json()
        version = body.get("version", 0)
        opinion = body.get("opinion", "")
        role = get_current_role(request)
        username = get_current_username(request)

        record = reject_record(db, record_id, version, opinion, username, role)
        result = FollowUpRecordOut.model_validate(record).model_dump(mode="json")
        return JSONResponse(result)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def process_record_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        record_id = int(request.path_params["record_id"])
        body = await request.json()
        data = ProcessRecordRequest(**body)
        role = get_current_role(request)
        username = get_current_username(request)

        record = process_record(db, record_id, data, username, role)
        result = FollowUpRecordOut.model_validate(record).model_dump(mode="json")
        return JSONResponse(result)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def batch_process_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        body = await request.json()
        data = BatchOperationRequest(**body)
        role = get_current_role(request)
        username = get_current_username(request)

        version_map = data.version_map or {}
        results = batch_process(db, data.record_ids, version_map, data.opinion or "", username, role)
        return JSONResponse(results)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def batch_reject_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        body = await request.json()
        data = BatchOperationRequest(**body)
        role = get_current_role(request)
        username = get_current_username(request)

        version_map = data.version_map or {}
        results = batch_reject(db, data.record_ids, version_map, data.opinion or "", username, role)
        return JSONResponse(results)
    except ValidationError as e:
        return error_response(e)
    finally:
        db.close()


async def list_patients_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        name = request.query_params.get("name")
        patients = list_patients(db, name)
        result = [PatientOut.model_validate(p).model_dump(mode="json") for p in patients]
        return JSONResponse(result)
    finally:
        db.close()


async def get_evidence_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        patient_id = int(request.path_params["patient_id"])
        evidence = list_evidence_for_patient(db, patient_id)
        result = {
            "appointments": [AppointmentOut.model_validate(a).model_dump(mode="json") for a in evidence["appointments"]],
            "visits": [VisitOut.model_validate(v).model_dump(mode="json") for v in evidence["visits"]],
            "follow_up_visits": [FollowUpVisitOut.model_validate(f).model_dump(mode="json") for f in evidence["follow_up_visits"]],
        }
        return JSONResponse(result)
    finally:
        db.close()


async def get_current_user_endpoint(request: Request):
    db: Session = next(get_db())
    try:
        username = get_current_username(request)
        user = get_current_user(db, username)
        if not user:
            return JSONResponse(
                status_code=404,
                content={"detail": "用户不存在", "error_code": "USER_NOT_FOUND"}
            )
        return JSONResponse({
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
        })
    finally:
        db.close()


async def get_roles_endpoint(request: Request):
    role_info = {
        "triage_nurse": {
            "name": "导诊护士",
            "allowed_statuses": list(ROLE_PERMISSIONS.get("triage_nurse", [])),
        },
        "gp_doctor": {
            "name": "全科医生",
            "allowed_statuses": list(ROLE_PERMISSIONS.get("gp_doctor", [])),
        },
        "medical_director": {
            "name": "医务科主任",
            "allowed_statuses": list(ROLE_PERMISSIONS.get("medical_director", [])),
        },
    }
    return JSONResponse(role_info)


async def list_users_endpoint(request: Request):
    from .database import User
    db: Session = next(get_db())
    try:
        users = db.query(User).all()
        result = [
            {"id": u.id, "username": u.username, "name": u.name, "role": u.role}
            for u in users
        ]
        return JSONResponse(result)
    finally:
        db.close()


async def health_endpoint(request):
    return JSONResponse({"status": "ok", "message": "随访记录补录校验系统运行中"})


routes = [
    Route("/api/health", health_endpoint, methods=["GET"]),
    Route("/api/records", list_records_endpoint, methods=["GET"]),
    Route("/api/records/{record_id:int}", get_record_endpoint, methods=["GET"]),
    Route("/api/records", create_record_endpoint, methods=["POST"]),
    Route("/api/records/{record_id:int}", update_record_endpoint, methods=["PUT"]),
    Route("/api/records/{record_id:int}/submit", submit_record_endpoint, methods=["POST"]),
    Route("/api/records/{record_id:int}/reject", reject_record_endpoint, methods=["POST"]),
    Route("/api/records/{record_id:int}/process", process_record_endpoint, methods=["POST"]),
    Route("/api/batch/process", batch_process_endpoint, methods=["POST"]),
    Route("/api/batch/reject", batch_reject_endpoint, methods=["POST"]),
    Route("/api/patients", list_patients_endpoint, methods=["GET"]),
    Route("/api/patients/{patient_id:int}/evidence", get_evidence_endpoint, methods=["GET"]),
    Route("/api/user/current", get_current_user_endpoint, methods=["GET"]),
    Route("/api/users", list_users_endpoint, methods=["GET"]),
    Route("/api/roles", get_roles_endpoint, methods=["GET"]),
]
