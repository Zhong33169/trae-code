from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .config import get_settings
from .models import (
    Role, Stage, Status, EvidenceType,
    ROLE_LABELS, STAGE_LABELS, STATUS_LABELS, EVIDENCE_TYPE_LABELS
)
from . import schemas, crud, services

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="培训项目单管理系统 API",
    description="企业培训公司培训项目单管理系统，支持异常申诉复核",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{settings.FRONTEND_PORT}",
        f"http://127.0.0.1:{settings.FRONTEND_PORT}",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/labels", response_model=schemas.LabelMap, tags=["基础数据"])
def get_labels():
    return schemas.LabelMap(
        roles={r.value: label for r, label in ROLE_LABELS.items()},
        stages={s.value: label for s, label in STAGE_LABELS.items()},
        statuses={s.value: label for s, label in STATUS_LABELS.items()},
        evidence_types={e.value: label for e, label in EVIDENCE_TYPE_LABELS.items()},
    )


@app.get("/api/users", response_model=List[schemas.User], tags=["用户"])
def list_users(db: Session = Depends(get_db)):
    return crud.get_users(db)


@app.get("/api/users/{user_id}", response_model=schemas.User, tags=["用户"])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@app.post("/api/users", response_model=schemas.User, tags=["用户"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return crud.create_user(db, user)


@app.get("/api/projects", response_model=List[schemas.TrainingProjectListItem], tags=["培训项目单"])
def list_projects(
    skip: int = 0,
    limit: int = 100,
    status: Optional[Status] = None,
    stage: Optional[Stage] = None,
    handler_id: Optional[int] = None,
    creator_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    projects = crud.get_projects(
        db,
        skip=skip,
        limit=limit,
        status=status,
        stage=stage,
        handler_id=handler_id,
        creator_id=creator_id,
    )
    result = []
    for p in projects:
        handler_name = p.current_handler.name if p.current_handler else None
        handler_role = p.current_handler.role if p.current_handler else None
        result.append(schemas.TrainingProjectListItem(
            id=p.id,
            project_no=p.project_no,
            project_name=p.project_name,
            client_company=p.client_company,
            stage=p.stage,
            status=p.status,
            version=p.version,
            current_handler_name=handler_name,
            current_handler_role=handler_role,
            created_at=p.created_at,
            updated_at=p.updated_at,
            is_overdue=p.is_overdue,
        ))
    return result


@app.get("/api/projects/{project_id}", response_model=schemas.TrainingProject, tags=["培训项目单"])
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@app.post("/api/projects", response_model=schemas.TrainingProject, tags=["培训项目单"])
def create_project(project: schemas.TrainingProjectCreate, db: Session = Depends(get_db)):
    user = crud.get_user(db, project.created_by_id)
    if not user:
        raise HTTPException(status_code=404, detail="创建用户不存在")
    if user.role != Role.REGISTRAR:
        raise HTTPException(status_code=400, detail="只有培训项目登记员可以创建项目")
    return crud.create_project(db, project)


@app.put("/api/projects/{project_id}", response_model=schemas.TrainingProject, tags=["培训项目单"])
def update_project(
    project_id: int,
    update: schemas.TrainingProjectUpdate,
    db: Session = Depends(get_db),
):
    project = crud.update_project(db, project_id, update)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@app.get("/api/projects/{project_id}/evidences", response_model=List[schemas.Evidence], tags=["证据材料"])
def list_project_evidences(project_id: int, db: Session = Depends(get_db)):
    return crud.get_project_evidences(db, project_id)


@app.post("/api/projects/{project_id}/evidences", response_model=schemas.Evidence, tags=["证据材料"])
def add_evidence(
    project_id: int,
    evidence: schemas.EvidenceCreate,
    db: Session = Depends(get_db),
):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return crud.add_evidence(db, evidence, project_id)


@app.delete("/api/projects/{project_id}/evidences/{evidence_id}", tags=["证据材料"])
def delete_evidence(
    project_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
):
    if not crud.remove_evidence(db, evidence_id):
        raise HTTPException(status_code=404, detail="证据不存在")
    return {"success": True}


@app.get("/api/projects/{project_id}/logs", response_model=List[schemas.OperationLog], tags=["操作记录"])
def list_project_logs(project_id: int, db: Session = Depends(get_db)):
    return crud.get_project_logs(db, project_id)


@app.get("/api/projects/{project_id}/appeals", response_model=List[schemas.AppealRecord], tags=["申诉记录"])
def list_project_appeals(project_id: int, db: Session = Depends(get_db)):
    return crud.get_project_appeals(db, project_id)


def _handle_business_error(e: services.BusinessError):
    status_map = {
        "user_not_found": 404,
        "project_not_found": 404,
        "role_not_allowed": 403,
        "not_current_handler": 403,
        "not_project_creator": 403,
        "version_conflict": 409,
        "status_not_allowed": 400,
        "missing_required_evidences": 400,
        "missing_reject_reason": 400,
        "project_overdue": 400,
        "no_pending_appeal": 400,
    }
    status_code = status_map.get(e.error_type, 400)
    raise HTTPException(status_code=status_code, detail=e.message)


@app.post("/api/projects/{project_id}/submit", response_model=schemas.TrainingProject, tags=["流程操作"])
def submit_project(
    project_id: int,
    data: schemas.SubmitData,
    version: Optional[int] = Query(None, description="期望版本号，用于乐观锁"),
    db: Session = Depends(get_db),
):
    try:
        return services.submit_project(db, project_id, data, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/review/approve", response_model=schemas.TrainingProject, tags=["流程操作"])
def approve_project(
    project_id: int,
    data: schemas.ReviewData,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.review_project(db, project_id, data, expected_version=version, approve=True)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/review/reject", response_model=schemas.TrainingProject, tags=["流程操作"])
def reject_project(
    project_id: int,
    data: schemas.ReviewData,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.review_project(db, project_id, data, expected_version=version, approve=False)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/return", response_model=schemas.TrainingProject, tags=["流程操作"])
def return_project(
    project_id: int,
    data: schemas.ReturnForCorrectionData,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.return_for_correction(db, project_id, data, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/correct", response_model=schemas.TrainingProject, tags=["流程操作"])
def correct_project(
    project_id: int,
    data: schemas.CorrectData,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.correct_project(db, project_id, data, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/recover", response_model=schemas.TrainingProject, tags=["流程操作"])
def recover_conflict(
    project_id: int,
    data: schemas.ConflictRecoveryData,
    version: Optional[int] = Query(None, description="期望版本号，用于乐观锁"),
    db: Session = Depends(get_db),
):
    try:
        return services.recover_from_conflict(db, project_id, data, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/appeal", response_model=schemas.TrainingProject, tags=["流程操作"])
def submit_appeal(
    project_id: int,
    data: schemas.AppealSubmitData,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.submit_appeal(db, project_id, data, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/appeal/review", response_model=schemas.TrainingProject, tags=["流程操作"])
def review_appeal(
    project_id: int,
    data: schemas.AppealReviewData,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.review_appeal(db, project_id, data, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/archive", response_model=schemas.TrainingProject, tags=["流程操作"])
def archive_project(
    project_id: int,
    current_user_id: int,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.archive_project(db, project_id, current_user_id, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/receive", response_model=schemas.TrainingProject, tags=["流程操作"])
def receive_project(
    project_id: int,
    current_user_id: int,
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.process_incoming_project(db, project_id, current_user_id, expected_version=version)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.post("/api/projects/{project_id}/mark-overdue", response_model=schemas.TrainingProject, tags=["流程操作"])
def mark_overdue(
    project_id: int,
    current_user_id: int,
    db: Session = Depends(get_db),
):
    try:
        return services.mark_overdue(db, project_id, current_user_id)
    except services.BusinessError as e:
        _handle_business_error(e)


@app.get("/api/statistics", response_model=schemas.Statistics, tags=["统计"])
def get_statistics(db: Session = Depends(get_db)):
    return schemas.Statistics(**crud.get_statistics(db))
