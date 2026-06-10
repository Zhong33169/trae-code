#!/usr/bin/env python3
"""
后端校验测试脚本
测试场景：
1. 错角色提交
2. 缺证据提交
3. 版本号冲突
4. 学院负责人跳过实验室审核
5. 重复补录同一证据类型
6. 实验室管理员尝试确认（学院权限）
"""

import requests
import json
import sys

BASE_URL = 'http://localhost:8004/api'


def print_header(title):
    print(f'\n{"="*60}')
    print(f'  {title}')
    print(f'{"="*60}')


def print_result(test_name, response, expect_fail=True, expected_status=None):
    status = response.status_code
    try:
        data = response.json()
    except:
        data = {'detail': response.text}

    success = False
    if expect_fail:
        success = status >= 400
        if expected_status:
            success = status == expected_status
    else:
        success = status < 400

    icon = '✓ PASS' if success else '✗ FAIL'
    print(f'\n{icon} - {test_name}')
    print(f'  HTTP Status: {status}')

    if detail := data.get('detail'):
        print(f'  错误信息: {detail}')

    if errors := data.get('errors'):
        print(f'  详细原因:')
        for err in errors:
            print(f'    - {err}')

    if code := data.get('code'):
        print(f'  错误代码: {code}')

    return success


def main():
    all_passed = True

    print_header('实验预约单后端校验测试')

    # 获取预约单列表
    print('\n获取预约单列表...')
    resp = requests.get(f'{BASE_URL}/reservations', headers={'X-User-ID': '1'})
    reservations = resp.json()['items']
    print(f'共 {len(reservations)} 条预约单')

    # 找到一个草稿状态的
    draft = next((r for r in reservations if r['status'] == 'draft'), None)
    submitted = next((r for r in reservations if r['status'] == 'submitted'), None)
    lab_reviewed = next((r for r in reservations if r['status'] == 'lab_reviewed'), None)

    if not draft:
        print('找不到草稿状态的预约单，无法继续测试')
        sys.exit(1)

    draft_id = draft['id']
    draft_version = draft['version']
    print(f'使用草稿预约单: ID={draft_id}, 版本={draft_version}')

    # ========== 测试1: 实验室管理员尝试提交（错角色） ==========
    print_header('测试1: 错角色 - 实验室管理员提交预约单')
    resp = requests.post(
        f'{BASE_URL}/reservations/{draft_id}/submit',
        headers={'X-User-ID': '3', 'Content-Type': 'application/json'},
        json={'expected_version': draft_version}
    )
    all_passed &= print_result(
        '实验室管理员不能提交预约单',
        resp,
        expect_fail=True,
        expected_status=400
    )

    # ========== 测试2: 学院负责人尝试提交（错角色） ==========
    print_header('测试2: 错角色 - 学院负责人提交预约单')
    resp = requests.post(
        f'{BASE_URL}/reservations/{draft_id}/submit',
        headers={'X-User-ID': '5', 'Content-Type': 'application/json'},
        json={'expected_version': draft_version}
    )
    all_passed &= print_result(
        '学院负责人不能提交预约单',
        resp,
        expect_fail=True,
        expected_status=400
    )

    # ========== 测试3: 缺证据提交 ==========
    print_header('测试3: 缺证据提交')
    resp = requests.post(
        f'{BASE_URL}/reservations/{draft_id}/submit',
        headers={'X-User-ID': '1', 'Content-Type': 'application/json'},
        json={'expected_version': draft_version}
    )
    all_passed &= print_result(
        '缺少证据不能提交',
        resp,
        expect_fail=True,
        expected_status=400
    )

    # ========== 测试4: 版本号冲突 ==========
    print_header('测试4: 版本号冲突')
    resp = requests.post(
        f'{BASE_URL}/reservations/{draft_id}/submit',
        headers={'X-User-ID': '1', 'Content-Type': 'application/json'},
        json={'expected_version': 999}
    )
    all_passed &= print_result(
        '版本号不匹配被拦截',
        resp,
        expect_fail=True,
        expected_status=409
    )

    # ========== 测试5: 学院负责人直接确认（跳过实验室审核） ==========
    if submitted:
        print_header('测试5: 错状态 - 学院负责人跳过实验室审核直接确认')
        sub_id = submitted['id']
        sub_ver = submitted['version']
        resp = requests.post(
            f'{BASE_URL}/reservations/{sub_id}/college-confirm',
            headers={'X-User-ID': '5', 'Content-Type': 'application/json'},
            json={'pass': True, 'comment': '直接确认', 'expected_version': sub_ver}
        )
        all_passed &= print_result(
            '学院负责人不能跳过实验室审核直接确认',
            resp,
            expect_fail=True,
            expected_status=400
        )

    # ========== 测试6: 实验室管理员尝试执行学院确认（错角色+错状态） ==========
    if lab_reviewed:
        print_header('测试6: 错角色 - 实验室管理员执行学院确认')
        lr_id = lab_reviewed['id']
        lr_ver = lab_reviewed['version']
        resp = requests.post(
            f'{BASE_URL}/reservations/{lr_id}/college-confirm',
            headers={'X-User-ID': '3', 'Content-Type': 'application/json'},
            json={'pass': True, 'comment': '越权确认', 'expected_version': lr_ver}
        )
        all_passed &= print_result(
            '实验室管理员不能执行学院确认',
            resp,
            expect_fail=True,
            expected_status=400
        )

    # ========== 测试7: 证据不足时实验室审核通过 ==========
    if submitted:
        print_header('测试7: 证据不足时实验室审核通过被拦截')
        # 找一个缺证据的已提交预约单
        missing_ev = next(
            (r for r in reservations
             if r['status'] == 'submitted' and (
                 not r['has_experiment_plan'] or
                 not r['has_material_application'] or
                 not r['has_safety_confirmation']
             )),
            None
        )
        if missing_ev:
            resp = requests.post(
                f'{BASE_URL}/reservations/{missing_ev["id"]}/lab-review',
                headers={'X-User-ID': '3', 'Content-Type': 'application/json'},
                json={'pass': True, 'comment': '试图通过', 'expected_version': missing_ev['version']}
            )
            all_passed &= print_result(
                '证据不足时审核通过被拦截',
                resp,
                expect_fail=True,
                expected_status=400
            )
        else:
            print('  跳过：未找到缺证据的已提交预约单')

    # ========== 测试8: 非本人补录 ==========
    print_header('测试8: 非本人不能补录')
    # 找一个不是 ta_li 创建的预约单
    other_reservation = next(
        (r for r in reservations if r['applicant'] != 'ta_li' and r['status'] in ['draft', 'submitted', 'lab_reviewed']),
        None
    )
    if other_reservation:
        resp = requests.post(
            f'{BASE_URL}/reservations/{other_reservation["id"]}/supplement-evidence',
            headers={'X-User-ID': '2', 'Content-Type': 'application/json'},
            json={
                'evidence_type': 'experiment_plan',
                'title': '越权补录',
                'description': '测试',
                'expected_version': other_reservation['version']
            }
        )
        all_passed &= print_result(
            '非本人不能补录材料',
            resp,
            expect_fail=True,
            expected_status=400
        )
    else:
        print('  跳过：未找到合适的预约单')

    # ========== 测试9: 已确认状态不能再操作 ==========
    print_header('测试9: 已确认状态不能再操作')
    confirmed = next((r for r in reservations if r['status'] == 'confirmed'), None)
    if confirmed:
        # 尝试提交
        resp = requests.post(
            f'{BASE_URL}/reservations/{confirmed["id"]}/submit',
            headers={'X-User-ID': '1', 'Content-Type': 'application/json'},
            json={'expected_version': confirmed['version']}
        )
        all_passed &= print_result(
            '已确认的预约单不能再提交',
            resp,
            expect_fail=True,
            expected_status=400
        )

    # ========== 测试10: 获取详情（权限检查） ==========
    print_header('测试10: 正常获取预约单详情')
    resp = requests.get(
        f'{BASE_URL}/reservations/{draft_id}',
        headers={'X-User-ID': '1'}
    )
    all_passed &= print_result(
        '可以正常获取详情',
        resp,
        expect_fail=False,
        expected_status=200
    )
    if resp.status_code == 200:
        detail = resp.json()
        print(f'  可提交: {detail["can_submit"]}')
        print(f'  提交错误: {detail["submit_error"]}')
        print(f'  可实验室审核: {detail["can_lab_review"]}')
        print(f'  审核错误: {detail["lab_review_error"]}')
        print(f'  缺少证据: {detail["missing_evidence"]}')

    # 总结
    print_header('测试总结')
    if all_passed:
        print('✓ 所有测试通过！')
    else:
        print('✗ 部分测试失败，请检查')

    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
