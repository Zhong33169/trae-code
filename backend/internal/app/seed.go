package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

func materialsFor(stage Stage, providedAll bool, missing ...string) []Material {
	ms := defaultMaterials(stage)
	if providedAll {
		for i := range ms {
			ms[i].Provided = true
		}
	}
	for i := range ms {
		for _, m := range missing {
			if ms[i].Name == m {
				ms[i].Provided = false
			}
		}
	}
	return ms
}

type seedStage struct {
	status        StageStatus
	materials     []Material
	opinion       string
	startOffsetH  int
	submittedH    *int
	reviewedH     *int
	timeLimit     int
	reviewComment string
}

type seedOrder struct {
	orderNo       string
	title         string
	customer      string
	phone         string
	address       string
	repairType    string
	priority      string
	slaHours      int
	deadlineH     int
	status        OrderStatus
	currentStage  Stage
	createdByRole Role
	stages        map[Stage]seedStage
}

func Seed(ctx context.Context, db *sql.DB) error {
	var count int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	users := []User{
		{Name: "陈窗口", Role: RoleWindowStaff},
		{Name: "李主管", Role: RoleMeterSupervisor},
		{Name: "王经理", Role: RoleBusinessManager},
	}
	userID := map[Role]int{}
	for _, u := range users {
		res, err := tx.ExecContext(ctx, `INSERT INTO users (name, role) VALUES (?, ?)`, u.Name, u.Role)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		userID[u.Role] = int(id)
	}

	h := func(v int) *int { return &v }
	now := time.Now()

	orders := []seedOrder{
		{
			orderNo: "WX-DEMO-001", title: "翠湖路32号主管漏水抢修", customer: "翠湖小区物业",
			phone: "13800000001", address: "翠湖路32号", repairType: "漏水", priority: "紧急",
			slaHours: 72, deadlineH: 60, status: StatusPendingReview, currentStage: StageRegistration,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusPending, materials: materialsFor(StageRegistration, false), startOffsetH: 0, timeLimit: 48},
				StageVerification: {status: StageStatusPending, materials: materialsFor(StageVerification, false), startOffsetH: 0, timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, false), startOffsetH: 0, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-002", title: "滨河大道主管爆管抢修", customer: "滨河商贸城",
			phone: "13800000002", address: "滨河大道188号", repairType: "爆管", priority: "紧急",
			slaHours: 72, deadlineH: 50, status: StatusPendingReview, currentStage: StageVerification,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "现场已勘察，漏水点已定位", startOffsetH: -20, submittedH: h(-20), timeLimit: 48},
				StageVerification: {status: StageStatusPending, materials: materialsFor(StageVerification, false), startOffsetH: -20, timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, false), startOffsetH: 0, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-003", title: "东郊水厂水质异常核查", customer: "东郊工业园",
			phone: "13800000003", address: "东郊工业园B区", repairType: "水质", priority: "普通",
			slaHours: 72, deadlineH: 40, status: StatusPendingReview, currentStage: StageVerification,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "接到水质投诉，已取样", startOffsetH: -10, submittedH: h(-10), timeLimit: 48},
				StageVerification: {status: StageStatusPending, materials: materialsFor(StageVerification, true), startOffsetH: -10, timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, false), startOffsetH: 0, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-004", title: "南苑路水表故障更换", customer: "南苑社区",
			phone: "13800000004", address: "南苑路66号", repairType: "水表故障", priority: "普通",
			slaHours: 72, deadlineH: 20, status: StatusPendingReview, currentStage: StageVerification,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "水表损坏已确认", startOffsetH: -15, submittedH: h(-15), timeLimit: 48},
				StageVerification: {status: StageStatusPending, materials: materialsFor(StageVerification, true, "核验记录单"), startOffsetH: -15, timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, false), startOffsetH: 0, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-005", title: "人民路阀门更换抢修", customer: "人民路沿街商户",
			phone: "13800000005", address: "人民路200号", repairType: "漏水", priority: "紧急",
			slaHours: 72, deadlineH: 30, status: StatusApproved, currentStage: StageArchiving,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "阀门老化需更换", startOffsetH: -28, submittedH: h(-28), timeLimit: 48},
				StageVerification: {status: StageStatusApproved, materials: materialsFor(StageVerification, true), opinion: "核验通过，施工合规", startOffsetH: -28, submittedH: h(-24), reviewedH: h(-24), reviewComment: "核验通过", timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, false), startOffsetH: -24, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-006", title: "西湖道夜间爆管应急抢修", customer: "西湖道居民",
			phone: "13800000006", address: "西湖道12号", repairType: "爆管", priority: "紧急",
			slaHours: 72, deadlineH: 10, status: StatusApproved, currentStage: StageArchiving,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "夜间爆管已控压", startOffsetH: -30, submittedH: h(-30), timeLimit: 48},
				StageVerification: {status: StageStatusApproved, materials: materialsFor(StageVerification, true), opinion: "复测合格", startOffsetH: -30, submittedH: h(-26), reviewedH: h(-26), reviewComment: "核验通过", timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, true), startOffsetH: -26, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-007", title: "北站片区管网渗漏抢修", customer: "北站管委会",
			phone: "13800000007", address: "北站片区枢纽", repairType: "漏水", priority: "紧急",
			slaHours: 72, deadlineH: -5, status: StatusApproved, currentStage: StageArchiving,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "渗漏点已封堵", startOffsetH: -80, submittedH: h(-80), timeLimit: 48},
				StageVerification: {status: StageStatusApproved, materials: materialsFor(StageVerification, true), opinion: "核验合格", startOffsetH: -80, submittedH: h(-76), reviewedH: h(-76), reviewComment: "核验通过", timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, true, "归档凭证"), startOffsetH: -76, timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-008", title: "高新路水表批量校验归档", customer: "高新园区物业",
			phone: "13800000008", address: "高新路99号", repairType: "水表故障", priority: "普通",
			slaHours: 72, deadlineH: 100, status: StatusSynced, currentStage: StageArchiving,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "批量校验完成", startOffsetH: -120, submittedH: h(-120), timeLimit: 48},
				StageVerification: {status: StageStatusApproved, materials: materialsFor(StageVerification, true), opinion: "抽检合格", startOffsetH: -120, submittedH: h(-116), reviewedH: h(-116), reviewComment: "核验通过", timeLimit: 48},
				StageArchiving:    {status: StageStatusApproved, materials: materialsFor(StageArchiving, true), opinion: "归档完成", startOffsetH: -116, submittedH: h(-110), reviewedH: h(-110), reviewComment: "已同步归档", timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-009", title: "老城区支管更换归档", customer: "老城街道办",
			phone: "13800000009", address: "老城东街45号", repairType: "爆管", priority: "紧急",
			slaHours: 72, deadlineH: -2, status: StatusSynced, currentStage: StageArchiving,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "支管更换完成", startOffsetH: -100, submittedH: h(-100), timeLimit: 48},
				StageVerification: {status: StageStatusApproved, materials: materialsFor(StageVerification, true), opinion: "复测合格", startOffsetH: -100, submittedH: h(-96), reviewedH: h(-96), reviewComment: "核验通过", timeLimit: 48},
				StageArchiving:    {status: StageStatusApproved, materials: materialsFor(StageArchiving, true), opinion: "已归档", startOffsetH: -96, submittedH: h(-90), reviewedH: h(-90), reviewComment: "已同步归档", timeLimit: 72},
			},
		},
		{
			orderNo: "WX-DEMO-010", title: "临港工业区突发停水抢修", customer: "临港管委会",
			phone: "13800000010", address: "临港工业区主干道", repairType: "爆管", priority: "紧急",
			slaHours: 72, deadlineH: 5, status: StatusPendingReview, currentStage: StageVerification,
			createdByRole: RoleWindowStaff,
			stages: map[Stage]seedStage{
				StageRegistration: {status: StageStatusSubmitted, materials: materialsFor(StageRegistration, true), opinion: "主干管爆裂已抢修", startOffsetH: -60, submittedH: h(-60), timeLimit: 48},
				StageVerification: {status: StageStatusPending, materials: materialsFor(StageVerification, true), startOffsetH: -60, timeLimit: 48},
				StageArchiving:    {status: StageStatusPending, materials: materialsFor(StageArchiving, false), startOffsetH: 0, timeLimit: 72},
			},
		},
	}

	for _, so := range orders {
		createdBy := userID[so.createdByRole]
		deadline := now.Add(time.Duration(so.deadlineH) * time.Hour)
		version := stageVersion(so.currentStage, so.status)
		res, err := tx.ExecContext(ctx, `INSERT INTO work_orders
			(order_no, title, customer_name, customer_phone, address, repair_type, priority, status, current_stage, deadline, sla_hours, created_by, version, created_at, updated_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			so.orderNo, so.title, so.customer, so.phone, so.address, so.repairType, so.priority,
			string(so.status), string(so.currentStage), fmtTime(deadline), so.slaHours, createdBy, version,
			fmtTime(now.Add(-72*time.Hour)), fmtTime(now))
		if err != nil {
			return fmt.Errorf("insert order %s: %w", so.orderNo, err)
		}
		oid, _ := res.LastInsertId()
		orderID := int(oid)

		for _, st := range []Stage{StageRegistration, StageVerification, StageArchiving} {
			ss := so.stages[st]
			mj, _ := json.Marshal(ss.materials)
			startedAt := now.Add(time.Duration(ss.startOffsetH) * time.Hour)
			var submittedAt, reviewedAt interface{}
			if ss.submittedH != nil {
				submittedAt = fmtTime(now.Add(time.Duration(*ss.submittedH) * time.Hour))
			}
			if ss.reviewedH != nil {
				reviewedAt = fmtTime(now.Add(time.Duration(*ss.reviewedH) * time.Hour))
			}
			_, err := tx.ExecContext(ctx, `INSERT INTO stage_records
				(order_id, stage, handler_role, handler_id, materials_json, processing_opinion, status, started_at, time_limit_hours, submitted_at, reviewed_at, reviewer_id, review_comment, created_at, updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				orderID, string(st), string(StageRole(st)), nil, string(mj), ss.opinion, string(ss.status),
				fmtTime(startedAt), ss.timeLimit, submittedAt, reviewedAt, nil, ss.reviewComment,
				fmtTime(now.Add(-72*time.Hour)), fmtTime(now))
			if err != nil {
				return fmt.Errorf("insert stage %s for %s: %w", st, so.orderNo, err)
			}
		}

		if err := seedAudit(ctx, tx, orderID, so, createdBy, userID, now); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func stageVersion(stage Stage, status OrderStatus) int {
	if status == StatusSynced {
		return 4
	}
	switch stage {
	case StageRegistration:
		return 1
	case StageVerification:
		return 2
	case StageArchiving:
		return 3
	}
	return 1
}

func seedAudit(ctx context.Context, tx *sql.Tx, orderID int, so seedOrder, createdBy int, userID map[Role]int, now time.Time) error {
	audits := []AuditLog{
		{Action: "create", ActorID: &createdBy, ActorRole: so.createdByRole, ToStatus: ptr(StatusPendingReview), ToStage: ptr(StageRegistration), Detail: "窗口人员创建抢修工单", VersionBefore: nil, VersionAfter: ptr(1)},
	}
	t := now.Add(-72 * time.Hour)
	if so.currentStage == StageVerification || so.currentStage == StageArchiving || so.status == StatusSynced {
		audits = append(audits, AuditLog{Action: "submit_registration", ActorID: &createdBy, ActorRole: RoleWindowStaff, FromStatus: ptr(StatusPendingReview), ToStatus: ptr(StatusPendingReview), FromStage: ptr(StageRegistration), ToStage: ptr(StageVerification), Detail: "窗口人员提交登记材料", VersionBefore: ptr(1), VersionAfter: ptr(2)})
	}
	if so.currentStage == StageArchiving || so.status == StatusSynced {
		supID := userID[RoleMeterSupervisor]
		audits = append(audits, AuditLog{Action: "approve_verification", ActorID: &supID, ActorRole: RoleMeterSupervisor, FromStatus: ptr(StatusPendingReview), ToStatus: ptr(StatusApproved), FromStage: ptr(StageVerification), ToStage: ptr(StageArchiving), Detail: "抄表主管核验通过，推进至复核归档", VersionBefore: ptr(2), VersionAfter: ptr(3)})
	}
	if so.status == StatusSynced {
		mgrID := userID[RoleBusinessManager]
		audits = append(audits, AuditLog{Action: "sync_archiving", ActorID: &mgrID, ActorRole: RoleBusinessManager, FromStatus: ptr(StatusApproved), ToStatus: ptr(StatusSynced), FromStage: ptr(StageArchiving), ToStage: ptr(StageArchiving), Detail: "营业经理复核归档并同步", VersionBefore: ptr(3), VersionAfter: ptr(4)})
	}
	for i, a := range audits {
		a.OrderID = orderID
		at := t.Add(time.Duration(i) * time.Hour)
		_, err := tx.ExecContext(ctx, `INSERT INTO audit_logs (order_id, action, actor_id, actor_role, from_status, to_status, from_stage, to_stage, detail, version_before, version_after, created_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
			a.OrderID, a.Action, intPtr(a.ActorID), string(a.ActorRole),
			ordStatus(a.FromStatus), ordStatus(a.ToStatus), stageStr(a.FromStage), stageStr(a.ToStage),
			a.Detail, ordInt(a.VersionBefore), ordInt(a.VersionAfter), fmtTime(at))
		if err != nil {
			return fmt.Errorf("insert audit for %s: %w", so.orderNo, err)
		}
	}
	return nil
}

func intPtr(i *int) interface{} {
	if i == nil {
		return nil
	}
	return *i
}

func ordInt(i *int) interface{} {
	if i == nil {
		return nil
	}
	return *i
}
