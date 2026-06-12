package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	if err = seedData(); err != nil {
		return fmt.Errorf("初始化数据失败: %w", err)
	}

	log.Println("数据库初始化成功")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		station TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS hazard_orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_no TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		location TEXT NOT NULL DEFAULT '',
		hazard_level TEXT NOT NULL DEFAULT 'general',
		status TEXT NOT NULL DEFAULT 'pending',
		current_node TEXT NOT NULL DEFAULT 'report',
		reporter_id INTEGER NOT NULL,
		reporter_name TEXT NOT NULL,
		supervisor_id INTEGER,
		supervisor_name TEXT DEFAULT '',
		station_chief_id INTEGER,
		station_chief_name TEXT DEFAULT '',
		rectify_deadline DATETIME,
		recheck_deadline DATETIME,
		is_timeout INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (reporter_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS hazard_reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		reporter_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		images TEXT NOT NULL DEFAULT '',
		node_deadline DATETIME NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES hazard_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS rectification_notices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		issuer_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		deadline DATETIME NOT NULL,
		node_deadline DATETIME NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES hazard_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS rectification_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		submitter_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		images TEXT NOT NULL DEFAULT '',
		submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES hazard_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS recheck_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		checker_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		result TEXT NOT NULL,
		images TEXT NOT NULL DEFAULT '',
		node_deadline DATETIME NOT NULL,
		checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES hazard_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS timeout_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		node_type TEXT NOT NULL,
		timeout_reason TEXT NOT NULL,
		handle_action TEXT NOT NULL,
		handler_id INTEGER NOT NULL,
		handler_name TEXT NOT NULL,
		original_deadline DATETIME NOT NULL,
		new_deadline DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES hazard_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS operation_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		user_name TEXT NOT NULL,
		action TEXT NOT NULL,
		from_status TEXT NOT NULL DEFAULT '',
		to_status TEXT NOT NULL DEFAULT '',
		from_node TEXT NOT NULL DEFAULT '',
		to_node TEXT NOT NULL DEFAULT '',
		remark TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES hazard_orders(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_orders_status ON hazard_orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_node ON hazard_orders(current_node);
	CREATE INDEX IF NOT EXISTS idx_logs_order ON operation_logs(order_id);
	CREATE INDEX IF NOT EXISTS idx_timeout_order ON timeout_records(order_id);
	`

	_, err := DB.Exec(schema)
	return err
}

func seedData() error {
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
		name     string
		role     string
		station  string
	}{
		{"clerk01", "123456", "张三(文员)", "clerk", "朝阳消防救援站"},
		{"clerk02", "123456", "李四(文员)", "clerk", "海淀消防救援站"},
		{"supervisor01", "123456", "王五(监督员)", "supervisor", "朝阳消防救援站"},
		{"supervisor02", "123456", "赵六(监督员)", "supervisor", "海淀消防救援站"},
		{"chief01", "123456", "钱七(站长)", "station_chief", "朝阳消防救援站"},
		{"chief02", "123456", "孙八(站长)", "station_chief", "海淀消防救援站"},
	}

	for _, u := range users {
		_, err := DB.Exec(
			"INSERT INTO users (username, password, name, role, station) VALUES (?, ?, ?, ?, ?)",
			u.username, u.password, u.name, u.role, u.station,
		)
		if err != nil {
			return err
		}
	}

	seedSampleOrders()
	return nil
}

func seedSampleOrders() {
	orders := []struct {
		orderNo     string
		title       string
		description string
		location    string
		level       string
		status      string
		node        string
		reporterID  int64
	}{
		{"XFA202506001", "消防通道堵塞隐患", "小区北侧消防通道被私家车长期占用，无法通行", "朝阳区幸福小区北区", "high", "pending", "report", 1},
		{"XFA202506002", "灭火器过期", "A栋3层走廊灭火器已过期3个月", "朝阳区阳光大厦A栋", "general", "assigned", "rectify", 1},
		{"XFA202506003", "消火栓无水", "地下车库消火栓压力不足，疑似无水", "海淀区中关村大厦B2", "critical", "revisited", "confirm", 2},
	}

	now := time.Now()
	for _, o := range orders {
		result, err := DB.Exec(`
			INSERT INTO hazard_orders 
			(order_no, title, description, location, hazard_level, status, current_node, 
			 reporter_id, reporter_name, supervisor_id, supervisor_name, station_chief_id, station_chief_name,
			 rectify_deadline, recheck_deadline, is_timeout, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			o.orderNo, o.title, o.description, o.location, o.level, o.status, o.node,
			o.reporterID, "张三(文员)",
			func() interface{} {
				if o.status == "pending" {
					return nil
				}
				return 3
			}(),
			func() string {
				if o.status == "pending" {
					return ""
				}
				return "王五(监督员)"
			}(),
			func() interface{} {
				if o.status != "revisited" {
					return nil
				}
				return 5
			}(),
			func() string {
				if o.status != "revisited" {
					return ""
				}
				return "钱七(站长)"
			}(),
			func() interface{} {
				if o.status == "pending" {
					return nil
				}
				return now.AddDate(0, 0, 7).Format("2006-01-02 15:04:05")
			}(),
			func() interface{} {
				if o.status != "revisited" {
					return nil
				}
				return now.AddDate(0, 0, 10).Format("2006-01-02 15:04:05")
			}(),
			0,
			now.Format("2006-01-02 15:04:05"),
			now.Format("2006-01-02 15:04:05"),
		)
		if err != nil {
			log.Printf("插入样例隐患单失败: %v", err)
			continue
		}

		orderID, _ := result.LastInsertId()

		_, _ = DB.Exec(`
			INSERT INTO hazard_reports (order_id, reporter_id, content, images, node_deadline, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, orderID, o.reporterID, o.description, "", now.AddDate(0, 0, 1), now)

		if o.status != "pending" {
			_, _ = DB.Exec(`
				INSERT INTO rectification_notices (order_id, issuer_id, content, deadline, node_deadline, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, orderID, 3, "请在规定期限内完成整改，消除安全隐患。", now.AddDate(0, 0, 7), now.AddDate(0, 0, 3), now)

			_, _ = DB.Exec(`
				INSERT INTO operation_logs (order_id, user_id, user_name, action, from_status, to_status, from_node, to_node, remark, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, orderID, 3, "王五(监督员)", "转办分派", "pending", "assigned", "report", "rectify", "已分派给责任单位整改", now)
		}

		if o.status == "revisited" {
			_, _ = DB.Exec(`
				INSERT INTO rectification_records (order_id, submitter_id, content, images, submitted_at)
				VALUES (?, ?, ?, ?, ?)
			`, orderID, 3, "已完成整改，修复了消火栓供水系统", "", now.AddDate(0, 0, 5))

			_, _ = DB.Exec(`
				INSERT INTO recheck_records (order_id, checker_id, content, result, images, node_deadline, checked_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, orderID, 5, "经复查，消火栓已恢复正常供水，压力符合标准", "pass", "", now.AddDate(0, 0, 10), now.AddDate(0, 0, 6))

			_, _ = DB.Exec(`
				INSERT INTO operation_logs (order_id, user_id, user_name, action, from_status, to_status, from_node, to_node, remark, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, orderID, 5, "钱七(站长)", "回访确认", "assigned", "revisited", "recheck", "confirm", "复查通过，隐患已消除", now.AddDate(0, 0, 6))
		}
	}
}
