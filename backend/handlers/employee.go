package handlers

import (
	"github.com/labstack/echo/v4"
	"transfer-system/db"
	"transfer-system/models"
	"transfer-system/utils"
)

func ListEmployees(c echo.Context) error {
	rows, err := db.DB.Query(
		"SELECT id, employee_no, name, department, position, current_salary FROM employees ORDER BY id",
	)
	if err != nil {
		return utils.Fail(c, 500, "查询员工列表失败")
	}
	defer rows.Close()

	employees := make([]models.Employee, 0)
	for rows.Next() {
		var e models.Employee
		if err := rows.Scan(&e.ID, &e.EmployeeNo, &e.Name, &e.Department, &e.Position, &e.CurrentSalary); err != nil {
			continue
		}
		employees = append(employees, e)
	}

	return utils.Success(c, employees)
}

func GetEmployee(c echo.Context) error {
	id := c.Param("id")
	var e models.Employee
	err := db.DB.QueryRow(
		"SELECT id, employee_no, name, department, position, current_salary FROM employees WHERE id = ?",
		id,
	).Scan(&e.ID, &e.EmployeeNo, &e.Name, &e.Department, &e.Position, &e.CurrentSalary)

	if err != nil {
		return utils.ErrorMsg(c, "员工不存在")
	}

	return utils.Success(c, e)
}
