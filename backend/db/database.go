package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建数据库目录失败: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	DB.SetMaxOpenConns(3)
	DB.SetMaxIdleConns(2)
	DB.SetConnMaxLifetime(time.Hour)

	if err = runMigrations(); err != nil {
		return fmt.Errorf("执行迁移失败: %w", err)
	}

	if err = seedInitialData(); err != nil {
		return fmt.Errorf("初始化数据失败: %w", err)
	}

	return nil
}

func runMigrations() error {
	schemaPath := filepath.Join("db", "schema.sql")
	sqlBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("读取schema文件失败: %w", err)
	}

	_, err = DB.Exec(string(sqlBytes))
	return err
}

func seedInitialData() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	users := []struct {
		username string
		password string
		realName string
		role     string
	}{
		{"hr01", "123456", "张三", "hr_specialist"},
		{"salary01", "123456", "李四", "salary_supervisor"},
		{"hrbp01", "123456", "王五", "hrbp_leader"},
	}

	for _, u := range users {
		hashed, err := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = DB.Exec(
			"INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)",
			u.username, string(hashed), u.realName, u.role,
		)
		if err != nil {
			return err
		}
	}

	employees := []struct {
		no       string
		name     string
		dept     string
		position string
		salary   float64
	}{
		{"E001", "赵六", "技术部", "前端工程师", 15000},
		{"E002", "孙七", "市场部", "市场专员", 12000},
		{"E003", "周八", "人事部", "招聘专员", 10000},
		{"E004", "吴九", "财务部", "会计", 13000},
		{"E005", "郑十", "运营部", "运营经理", 18000},
		{"E006", "陈十一", "技术部", "后端工程师", 16000},
	}

	for _, e := range employees {
		_, err = DB.Exec(
			"INSERT INTO employees (employee_no, name, department, position, current_salary) VALUES (?, ?, ?, ?, ?)",
			e.no, e.name, e.dept, e.position, e.salary,
		)
		if err != nil {
			return err
		}
	}

	seedDemoApplications()

	return nil
}

func seedDemoApplications() {
	now := time.Now()
	pastDeadline := now.Add(-48 * time.Hour)
	futureDeadline := now.Add(24 * time.Hour)

	demos := []struct {
		appNo         string
		empID         int
		appType       string
		fromDept      string
		toDept        string
		fromPos       string
		toPos         string
		fromSalary    float64
		toSalary      float64
		reason        string
		status        string
		currentNode   string
		budgetV       int
		salaryP       int
		registered    int
		createdBy     int
		isTimeout     int
		timeoutReason string
		deadline      *time.Time
		trails        []struct {
			node          string
			handlerID     int
			handlerName   string
			action        string
			remark        string
			status        string
			isTimeout     int
			timeoutReason string
		}
	}{
		{
			appNo: "TR-DEMO-001", empID: 1, appType: "both",
			fromDept: "技术部", toDept: "产品部", fromPos: "前端工程师", toPos: "产品经理",
			fromSalary: 15000, toSalary: 18000, reason: "部门调整需要，员工能力匹配产品岗位",
			status: "pending_review", currentNode: "hr_specialist", budgetV: 0, salaryP: 0, registered: 0,
			createdBy: 1, isTimeout: 0, deadline: &futureDeadline,
			trails: []struct {
				node          string
				handlerID     int
				handlerName   string
				action        string
				remark        string
				status        string
				isTimeout     int
				timeoutReason string
			}{
				{"hr_specialist", 1, "张三", "发起申请", "部门调整需要", "待审核", 0, ""},
			},
		},
		{
			appNo: "TR-DEMO-002", empID: 2, appType: "salary_adjustment",
			fromDept: "市场部", toDept: "", fromPos: "市场专员", toPos: "",
			fromSalary: 12000, toSalary: 15000, reason: "年度绩效优秀，薪资调整",
			status: "budget_checking", currentNode: "salary_supervisor", budgetV: 0, salaryP: 0, registered: 0,
			createdBy: 1, isTimeout: 1, timeoutReason: "薪酬主管24小时内未处理预算校验", deadline: &pastDeadline,
			trails: []struct {
				node          string
				handlerID     int
				handlerName   string
				action        string
				remark        string
				status        string
				isTimeout     int
				timeoutReason string
			}{
				{"hr_specialist", 1, "张三", "发起申请", "年度绩效优秀", "已提交", 0, ""},
				{"hr_specialist", 1, "张三", "提交审核", "", "已提交", 0, ""},
			},
		},
		{
			appNo: "TR-DEMO-003", empID: 3, appType: "transfer",
			fromDept: "人事部", toDept: "行政部", fromPos: "招聘专员", toPos: "行政专员",
			fromSalary: 10000, toSalary: 0, reason: "个人发展需求，申请调入行政部",
			status: "pending_confirm", currentNode: "hrbp_leader", budgetV: 1, salaryP: 1, registered: 0,
			createdBy: 1, isTimeout: 0, deadline: &futureDeadline,
			trails: []struct {
				node          string
				handlerID     int
				handlerName   string
				action        string
				remark        string
				status        string
				isTimeout     int
				timeoutReason string
			}{
				{"hr_specialist", 1, "张三", "发起申请", "个人发展需求", "已提交", 0, ""},
				{"hr_specialist", 1, "张三", "提交审核", "", "已提交", 0, ""},
				{"salary_supervisor", 2, "李四", "预算校验", "预算充足", "预算已校验", 0, ""},
				{"salary_supervisor", 2, "李四", "调薪处理", "", "调薪已处理", 0, ""},
				{"salary_supervisor", 2, "李四", "提交确认", "", "预算校验通过", 0, ""},
			},
		},
		{
			appNo: "TR-DEMO-004", empID: 4, appType: "both",
			fromDept: "财务部", toDept: "技术部", fromPos: "会计", toPos: "数据分析师",
			fromSalary: 13000, toSalary: 16000, reason: "岗位适配调整，员工数据分析能力突出",
			status: "approved", currentNode: "completed", budgetV: 1, salaryP: 1, registered: 0,
			createdBy: 1, isTimeout: 0, deadline: nil,
			trails: []struct {
				node          string
				handlerID     int
				handlerName   string
				action        string
				remark        string
				status        string
				isTimeout     int
				timeoutReason string
			}{
				{"hr_specialist", 1, "张三", "发起申请", "岗位适配调整", "已提交", 0, ""},
				{"hr_specialist", 1, "张三", "提交审核", "", "已提交", 0, ""},
				{"salary_supervisor", 2, "李四", "预算校验", "预算已批", "预算已校验", 0, ""},
				{"salary_supervisor", 2, "李四", "调薪处理", "调薪方案已确认", "调薪已处理", 0, ""},
				{"salary_supervisor", 2, "李四", "提交确认", "", "预算校验通过", 0, ""},
				{"hrbp_leader", 3, "王五", "审核通过", "同意", "审核通过", 0, ""},
			},
		},
		{
			appNo: "TR-DEMO-005", empID: 5, appType: "both",
			fromDept: "运营部", toDept: "市场部", fromPos: "运营经理", toPos: "市场总监",
			fromSalary: 18000, toSalary: 22000, reason: "组织架构调整，市场部需要资深管理",
			status: "synced", currentNode: "completed", budgetV: 1, salaryP: 1, registered: 1,
			createdBy: 1, isTimeout: 0, deadline: nil,
			trails: []struct {
				node          string
				handlerID     int
				handlerName   string
				action        string
				remark        string
				status        string
				isTimeout     int
				timeoutReason string
			}{
				{"hr_specialist", 1, "张三", "发起申请", "组织架构调整", "已提交", 0, ""},
				{"hr_specialist", 1, "张三", "提交审核", "", "已提交", 0, ""},
				{"salary_supervisor", 2, "李四", "预算校验", "预算通过", "预算已校验", 0, ""},
				{"salary_supervisor", 2, "李四", "调薪处理", "", "调薪已处理", 0, ""},
				{"salary_supervisor", 2, "李四", "提交确认", "", "预算校验通过", 0, ""},
				{"hrbp_leader", 3, "王五", "审核通过", "同意", "审核通过", 0, ""},
				{"hr_specialist", 1, "张三", "异动登记", "已办理完毕", "已登记", 0, ""},
			},
		},
		{
			appNo: "TR-DEMO-006", empID: 6, appType: "salary_adjustment",
			fromDept: "技术部", toDept: "", fromPos: "后端工程师", toPos: "",
			fromSalary: 16000, toSalary: 19000, reason: "技术晋升，薪资同步调整",
			status: "rejected", currentNode: "salary_supervisor", budgetV: 0, salaryP: 0, registered: 0,
			createdBy: 1, isTimeout: 1, timeoutReason: "薪酬主管超时未处理，后经核实预算不足驳回",
			deadline: &pastDeadline,
			trails: []struct {
				node          string
				handlerID     int
				handlerName   string
				action        string
				remark        string
				status        string
				isTimeout     int
				timeoutReason string
			}{
				{"hr_specialist", 1, "张三", "发起申请", "技术晋升", "已提交", 0, ""},
				{"hr_specialist", 1, "张三", "提交审核", "", "已提交", 0, ""},
				{"salary_supervisor", 2, "李四", "驳回申请", "本季度预算不足", "已驳回", 1, "薪酬主管超时未处理，后经核实预算不足驳回"},
			},
		},
	}

	for _, d := range demos {
		var deadlineArg interface{}
		if d.deadline != nil {
			deadlineArg = d.deadline.Format("2006-01-02 15:04:05")
		}

		result, err := DB.Exec(`
			INSERT INTO transfer_applications
			(application_no, employee_id, type, from_department, to_department, from_position, to_position,
			 from_salary, to_salary, reason, status, current_node, budget_verified, salary_processed, registered,
			 created_by, updated_by, is_timeout, timeout_reason, node_deadline)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			d.appNo, d.empID, d.appType, d.fromDept, d.toDept, d.fromPos, d.toPos,
			d.fromSalary, d.toSalary, d.reason, d.status, d.currentNode, d.budgetV, d.salaryP, d.registered,
			d.createdBy, d.createdBy, d.isTimeout, d.timeoutReason, deadlineArg,
		)
		if err != nil {
			continue
		}

		appID, _ := result.LastInsertId()

		for _, t := range d.trails {
			var handlerIDArg interface{}
			if t.handlerID > 0 {
				handlerIDArg = t.handlerID
			}
			DB.Exec(`
				INSERT INTO processing_trails
				(application_id, node, handler_id, handler_name, action, remark, status, is_timeout, timeout_reason)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				appID, t.node, handlerIDArg, t.handlerName, t.action, t.remark, t.status, t.isTimeout, t.timeoutReason,
			)
		}

		DB.Exec(`
			INSERT INTO operation_logs (user_id, user_name, user_role, action, target_type, target_id, detail)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			d.createdBy, "张三", "hr_specialist", "create_application", "transfer_application", appID, "创建演示申请: "+d.appNo,
		)
	}
}
