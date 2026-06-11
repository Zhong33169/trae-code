#!/usr/bin/env python3
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_sqlite_conn
from app.utils.application_no import generate_application_no


def seed_sample_data():
    print("=" * 60)
    print("银行网点-风险分级处置开户申请系统 - 样例数据加载")
    print("=" * 60)

    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM account_applications")
        app_count = cursor.fetchone()[0]
        if app_count > 0:
            print(f"\nℹ 已存在 {app_count} 条开户申请，是否清空并重新加载？(y/n): ", end="")
            choice = "y"
            if choice.lower() != "y":
                print("已取消加载样例数据")
                return
            cursor.execute("DELETE FROM operation_records")
            cursor.execute("DELETE FROM evidence_items")
            cursor.execute("DELETE FROM risk_level_logs")
            cursor.execute("DELETE FROM account_applications")
            conn.commit()
            print("✓ 已清空原有数据")

        today = datetime.now()
        users = {
            "wang": 1,
            "li": 2,
            "zhang": 3,
            "chen": 4,
            "liu": 5,
        }

        samples = [
            {
                "name": "张三",
                "id_card": "110101199001011234",
                "phone": "13800138001",
                "account_type": "个人储蓄账户",
                "risk_level": "low",
                "risk_reason": None,
                "stage": "开户预约",
                "status": "待签收",
                "handler_id": users["wang"],
                "deadline": today + timedelta(days=3),
                "is_overdue": 0,
                "is_evidence_missing": 0,
                "is_returned": 0,
                "returned_reason": None,
                "version": 1,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "水电费账单", 1, 1),
                    ("收入证明", "工资流水", 0, 0),
                ],
                "description": "【正常】低风险，待客户经理签收处理（含失败操作留痕）",
                "failed_operations": [
                    ("开户预约", "待签收", "low", users["li"], "运营主管", "越权操作被拒：运营主管无权处理开户预约阶段的申请"),
                ],
            },
            {
                "name": "李四",
                "id_card": "110101198505055678",
                "phone": "13800138002",
                "account_type": "个人结算账户",
                "risk_level": "high",
                "risk_reason": "客户为异地户籍，开户用途存疑，需加强尽职调查",
                "stage": "开户预约",
                "status": "待签收",
                "handler_id": users["chen"],
                "deadline": today + timedelta(days=1),
                "is_overdue": 0,
                "is_evidence_missing": 0,
                "is_returned": 0,
                "returned_reason": None,
                "version": 2,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "租房合同", 1, 1),
                    ("职业证明", "工作单位证明", 0, 1),
                    ("资金来源证明", "银行流水", 0, 1),
                ],
                "description": "【高风险识别】高风险标红，需额外提供职业和资金来源证明",
                "risk_logs": [
                    (users["wang"], "客户经理", "low", "medium", "客户为异地开户，初步识别为中风险"),
                    (users["li"], "运营主管", "medium", "high", "经复核，客户开户用途不明确，升级为高风险"),
                ],
            },
            {
                "name": "王五",
                "id_card": "110101197803039012",
                "phone": "13800138003",
                "account_type": "个体工商户结算账户",
                "risk_level": "medium",
                "risk_reason": "个体工商户，需核实经营真实性",
                "stage": "资料审核",
                "status": "异常回传",
                "handler_id": users["li"],
                "deadline": today - timedelta(days=2),
                "is_overdue": 1,
                "is_evidence_missing": 1,
                "is_returned": 1,
                "returned_reason": "缺少营业执照正本和经营场所证明，请补充后重新提交",
                "version": 3,
                "evidences": [
                    ("身份证明", "经营者身份证原件", 1, 1),
                    ("营业执照", "营业执照正本", 0, 1),
                    ("经营场所证明", "房屋租赁合同", 0, 1),
                    ("税务登记证", "税务登记证明", 1, 0),
                ],
                "description": "【缺证据+逾期+退回补正】资料审核阶段，缺证据、已逾期、已退回",
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理完成预约，提交资料审核"),
                    (None, None, "待签收", "异常回传", None, None, "运营主管审核发现证据缺失，退回补正"),
                ],
            },
            {
                "name": "赵六",
                "id_card": "110101199208083456",
                "phone": "13800138004",
                "account_type": "个人储蓄账户",
                "risk_level": "low",
                "risk_reason": None,
                "stage": "资料审核",
                "status": "签收完成",
                "handler_id": users["liu"],
                "deadline": today + timedelta(days=5),
                "is_overdue": 0,
                "is_evidence_missing": 0,
                "is_returned": 0,
                "returned_reason": None,
                "version": 2,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "房产证复印件", 1, 1),
                ],
                "description": "【正常流程中】资料审核完成，等待运营主管推进到账户启用",
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理完成预约，提交资料审核"),
                    (None, None, "待签收", "签收完成", None, None, "运营主管审核通过，资料齐全"),
                ],
            },
            {
                "name": "孙七",
                "id_card": "110101198812127890",
                "phone": "13800138005",
                "account_type": "个人结算账户",
                "risk_level": "high",
                "risk_reason": "客户涉及可疑交易监测名单，需严格审核",
                "stage": "账户启用",
                "status": "待签收",
                "handler_id": users["zhang"],
                "deadline": today + timedelta(days=2),
                "is_overdue": 0,
                "is_evidence_missing": 0,
                "is_returned": 0,
                "returned_reason": None,
                "version": 3,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "水电费账单", 1, 1),
                    ("职业证明", "工作证明", 1, 1),
                    ("尽职调查", "客户身份尽职调查表", 1, 1),
                ],
                "description": "【高风险待最终审批】已到账户启用阶段，高风险客户需支行行长最终审批",
                "risk_logs": [
                    (users["wang"], "客户经理", "low", "medium", "系统提示客户涉及监测名单"),
                    (users["li"], "运营主管", "medium", "high", "经人工复核，确认需加强审核，升级为高风险"),
                ],
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理完成预约"),
                    (None, None, "待签收", "签收完成", None, None, "运营主管资料审核通过"),
                    ("资料审核", "账户启用", "签收完成", "待签收", None, None, "运营主管推进至账户启用，待行长审批"),
                ],
            },
            {
                "name": "周八",
                "id_card": "110101199506062345",
                "phone": "13800138006",
                "account_type": "个人储蓄账户",
                "risk_level": "low",
                "risk_reason": None,
                "stage": "账户启用",
                "status": "异常回传",
                "handler_id": users["zhang"],
                "deadline": today - timedelta(days=1),
                "is_overdue": 1,
                "is_evidence_missing": 0,
                "is_returned": 1,
                "returned_reason": "客户签字与身份证签字样式不符，需重新面签",
                "version": 4,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "租房合同", 1, 1),
                    ("开户申请书", "开户申请书签字页", 0, 1),
                ],
                "description": "【状态冲突+退回】账户启用阶段被退回，需客户经理重新面签后再走流程",
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理完成预约"),
                    (None, None, "待签收", "签收完成", None, None, "运营主管资料审核通过"),
                    ("资料审核", "账户启用", "签收完成", "待签收", None, None, "运营主管推进至账户启用"),
                    (None, None, "待签收", "异常回传", None, None, "支行行长发现签字不符，退回重签"),
                ],
            },
            {
                "name": "吴九",
                "id_card": "110101199109096789",
                "phone": "13800138007",
                "account_type": "个人结算账户",
                "risk_level": "low",
                "risk_reason": None,
                "stage": "账户启用",
                "status": "签收完成",
                "handler_id": users["zhang"],
                "deadline": today - timedelta(days=1),
                "is_overdue": 0,
                "is_evidence_missing": 0,
                "is_returned": 0,
                "returned_reason": None,
                "version": 3,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "房产证复印件", 1, 1),
                    ("职业证明", "工作单位证明", 1, 1),
                ],
                "description": "【顺利完成归档】全流程正常完成，已归档",
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理王经理完成预约"),
                    (None, None, "待签收", "签收完成", None, None, "运营主管李主管审核通过"),
                    ("资料审核", "账户启用", "签收完成", "待签收", None, None, "运营主管推进至账户启用"),
                    (None, None, "待签收", "签收完成", None, None, "支行行长张行长审批通过，账户已启用"),
                ],
            },
            {
                "name": "郑十",
                "id_card": "110101198704044567",
                "phone": "13800138008",
                "account_type": "个体工商户结算账户",
                "risk_level": "medium",
                "risk_reason": "注册资本较高，需核实资金来源",
                "stage": "开户预约",
                "status": "异常回传",
                "handler_id": users["wang"],
                "deadline": today + timedelta(days=5),
                "is_overdue": 0,
                "is_evidence_missing": 1,
                "is_returned": 1,
                "returned_reason": "请补充公司章程和股东出资证明",
                "version": 2,
                "evidences": [
                    ("身份证明", "经营者身份证原件", 1, 1),
                    ("营业执照", "营业执照正本", 1, 1),
                    ("公司章程", "公司章程", 0, 1),
                    ("出资证明", "股东出资证明", 0, 1),
                ],
                "description": "【退回补正在预约阶段】客户经理录入信息不全被运营主管回传",
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理提交审核"),
                    (None, None, "待签收", "异常回传", "资料审核", "开户预约", "运营主管发现资料不全，退回客户经理补充"),
                ],
            },
            {
                "name": "冯十一",
                "id_card": "110101198805055678",
                "phone": "13800138009",
                "account_type": "个人人民币结算账户",
                "risk_level": "low",
                "risk_reason": "资料齐全，身份核实无误，风险已排除",
                "stage": "账户启用",
                "status": "待签收",
                "handler_id": users["zhang"],
                "deadline": today + timedelta(days=7),
                "is_overdue": 0,
                "is_evidence_missing": 0,
                "is_returned": 0,
                "returned_reason": None,
                "version": 4,
                "evidences": [
                    ("身份证明", "居民身份证原件", 1, 1),
                    ("住址证明", "水电缴费单", 1, 1),
                    ("职业证明", "劳动合同", 1, 1),
                    ("补充说明", "关于交易背景的补充说明", 1, 1),
                ],
                "description": "【高风险降级留痕】初始高风险→中风险→低风险，完整降级追溯",
                "operations": [
                    ("开户预约", "资料审核", "待签收", "待签收", None, None, "客户经理王经理完成预约"),
                    (None, None, "待签收", "签收完成", None, None, "运营主管李主管签收审核"),
                    (None, None, "待签收", "签收完成", None, None, "支行行长张行长签收，最终审批中"),
                ],
                "risk_logs": [
                    (users["li"], "运营主管", "high", "medium", "经核实交易对手为正规企业，交易背景真实，风险降级"),
                    (users["zhang"], "支行行长", "medium", "low", "补充职业证明和住址证明，身份完全核实，风险排除"),
                ],
            },
        ]

        print("\n正在加载样例数据...\n")
        for idx, sample in enumerate(samples, 1):
            app_no = generate_application_no(conn)
            print(f"[{idx}/{len(samples)}] {sample['description']}")
            print(f"    申请人: {sample['name']} | 账号: {app_no} | 风险: {sample['risk_level']}")
            print(f"    阶段: {sample['stage']} | 状态: {sample['status']}")

            cursor.execute(
                """
                INSERT INTO account_applications (
                    application_no, applicant_name, applicant_id_card, applicant_phone,
                    account_type, risk_level, risk_reason, stage, status, current_handler_id,
                    version, deadline, is_overdue, is_evidence_missing, is_returned, returned_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    app_no, sample["name"], sample["id_card"], sample["phone"],
                    sample["account_type"], sample["risk_level"], sample["risk_reason"],
                    sample["stage"], sample["status"], sample["handler_id"],
                    sample["version"], sample["deadline"].isoformat(),
                    sample["is_overdue"], sample["is_evidence_missing"],
                    sample["is_returned"], sample["returned_reason"],
                )
            )
            app_id = cursor.lastrowid

            for ev_type, ev_name, is_provided, is_required in sample["evidences"]:
                verified_at = None
                verified_by = None
                if is_provided == 1 and is_required == 1:
                    verified_at = sample["deadline"].isoformat()
                    verified_by = sample["handler_id"]
                cursor.execute(
                    """
                    INSERT INTO evidence_items (
                        application_id, evidence_type, evidence_name, is_provided, is_required,
                        verified_at, verified_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (app_id, ev_type, ev_name, is_provided, is_required, verified_at, verified_by)
                )

            if "risk_logs" in sample:
                for operator_id, operator_role, from_level, to_level, reason in sample["risk_logs"]:
                    cursor.execute(
                        """
                        INSERT INTO risk_level_logs (
                            application_id, operator_id, operator_role, from_level, to_level, change_reason
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (app_id, operator_id, operator_role, from_level, to_level, reason)
                    )

            if "operations" in sample:
                for op in sample["operations"]:
                    from_stage, to_stage, from_status, to_status, from_risk, to_risk, remark = op
                    cursor.execute(
                        """
                        INSERT INTO operation_records (
                            application_id, operator_id, operator_role, operation_type,
                            is_success, from_stage, to_stage, from_status, to_status,
                            from_risk_level, to_risk_level, remark,
                            version_before, version_after
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            app_id, sample["handler_id"],
                            "运营主管" if "资料审核" in str(from_stage) or "资料审核" in str(to_stage) else "客户经理",
                            "状态流转" if from_status != to_status else "阶段推进",
                            1,
                            from_stage, to_stage, from_status, to_status,
                            from_risk, to_risk, remark,
                            sample["version"] - 1, sample["version"],
                        )
                    )

            if "failed_operations" in sample:
                for fop in sample["failed_operations"]:
                    f_stage, f_status, f_risk, f_operator_id, f_operator_role, f_reason = fop
                    cursor.execute(
                        """
                        INSERT INTO operation_records (
                            application_id, operator_id, operator_role, operation_type,
                            is_success, from_stage, to_stage, from_status, to_status,
                            from_risk_level, to_risk_level, remark,
                            version_before, version_after
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            app_id, f_operator_id, f_operator_role, "操作失败",
                            0,
                            f_stage, None, f_status, None,
                            f_risk, None, f_reason,
                            sample["version"], sample["version"],
                        )
                    )

            print()

        conn.commit()
        print("=" * 60)
        print(f"✓ 成功加载 {len(samples)} 条样例开户申请")
        print("=" * 60)
        print("\n样例数据概览:")
        print(f"  正常通过: 4条 (张三含失败留痕、赵六流程中，吴九已完成，冯十一待归档)")
        print(f"  缺证据: 2条 (王五-经营资料、郑十-工商资料)")
        print(f"  逾期: 2条 (王五超期2天、周八超期1天)")
        print(f"  退回补正: 3条 (王五、周八、郑十)")
        print(f"  状态冲突: 1条 (周八-账户启用被退回，需重走流程)")
        print(f"  高风险识别: 2条 (李四、孙七)")
        print(f"  风险等级变更留痕: 3条 (李四、孙七升级，冯十一降级)")
        print(f"  高风险降级追溯: 1条 (冯十一: 高→中→低完整降级链路)")
        print(f"  失败操作留痕: 1条 (张三-运营主管越权操作被拒，原状态保留)")

    except Exception as e:
        print(f"\n✗ 错误: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    seed_sample_data()
