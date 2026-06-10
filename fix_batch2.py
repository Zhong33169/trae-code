
with open('backend/reservations/api.py', 'r') as f:
    lines = f.readlines()

# 1. 找到前面的批量接口定义
batch_front_start = None
batch_front_end = None
for i, line in enumerate(lines):
    if "@api.post('/reservations/batch'" in line:
        batch_front_start = i
    if batch_front_start is not None and i > batch_front_start:
        if line.strip() == '' and i > batch_front_start + 5:
            # 检查后面是不是详情接口
            if i+1 < len(lines) and '@api.get' in lines[i+1] and '{reservation_id}' in lines[i+1]:
                batch_front_end = i
                break

print(f"前半部分起始: {batch_front_start + 1}")
print(f"前半部分结束: {batch_front_end + 1 if batch_front_end else None}")

# 2. 找到后面的批量接口孤儿代码
# 孤儿代码在补录接口的 return 之后
orphan_start = None
orphan_end = None

# 先找到补录接口的 return
supplement_return = None
for i, line in enumerate(lines):
    if 'return reservation_to_detail(reservation, user)' in line:
        # 检查是不是补录接口的
        for j in range(max(0, i-100), i):
            if 'supplement-evidence' in lines[j]:
                supplement_return = i
                break
        if supplement_return:
            break

print(f"补录接口 return 行: {supplement_return + 1 if supplement_return else None}")

if supplement_return:
    # 从补录接口 return 之后找孤儿代码的开始
    for i in range(supplement_return + 1, len(lines)):
        if lines[i].strip() == '':
            continue
        # 找到第一个非空行，应该是孤儿代码的开始
        if 'valid_operations' in lines[i] and 'lab_review_pass' in lines[i]:
            orphan_start = i
            break

print(f"孤儿代码起始: {orphan_start + 1 if orphan_start else None}")

# 找到孤儿代码的结束（最后一个 return 之后）
if orphan_start:
    # 从孤儿代码开始往后找函数结束
    # 孤儿代码应该在文件末尾附近，以 return 语句结束
    # 找到最后的 return { 语句
    for i in range(len(lines)-1, orphan_start, -1):
        if lines[i].strip() == 'return {':
            # 找到对应的结束
            # 往下找 } 之后的空行
            for j in range(i, len(lines)):
                if lines[j].strip() == '}' and j > i:
                    # 后面的空行
                    end_line = j
                    for k in range(j+1, len(lines)):
                        if lines[k].strip() == '':
                            end_line = k
                        else:
                            break
                    orphan_end = end_line
                    break
            break

    if not orphan_end:
        # 试试找文件末尾
        for i in range(len(lines)-1, orphan_start, -1):
            if lines[i].strip():
                orphan_end = i
                break

print(f"孤儿代码结束: {orphan_end + 1 if orphan_end else None}")

if batch_front_start and batch_front_end and orphan_start and orphan_end:
    # 提取孤儿代码
    orphan_code = lines[orphan_start:orphan_end + 1]
    print(f"孤儿代码行数: {len(orphan_code)}")
    
    # 检查缩进
    if orphan_code and orphan_code[0].startswith('    '):
        print("孤儿代码有 4 空格缩进")
    
    # 构建新文件
    # 前半部分之前 + 前半部分 + 孤儿代码 + 空行 + 中间部分（详情接口等到补录接口） + 孤儿代码之后的部分
    
    before_front = lines[:batch_front_start]
    front_part = lines[batch_front_start:batch_front_end + 1]
    middle_part = lines[batch_front_end + 1:orphan_start]  # 详情接口等到孤儿代码之前
    after_orphan = lines[orphan_end + 1:]
    
    print(f"前半部分之前行数: {len(before_front)}")
    print(f"前半部分行数: {len(front_part)}")
    print(f"中间部分行数: {len(middle_part)}")
    print(f"孤儿代码之后行数: {len(after_orphan)}")
    
    # 合并
    new_lines = before_front + front_part + orphan_code + ['\n'] + middle_part + after_orphan
    
    print(f"新文件总行数: {len(new_lines)}")
    
    with open('backend/reservations/api.py', 'w') as f:
        f.writelines(new_lines)
    
    print("修复完成！")
    
    # 验证
    with open('backend/reservations/api.py', 'r') as f:
        verify = f.readlines()
    
    # 检查批量接口
    batch_count = 0
    for i, line in enumerate(verify):
        if 'batch' in line.lower() and ('def ' in line or '@api' in line):
            print(f"  行{i+1}: {line.strip()[:80]}")
            batch_count += 1
    
    # 检查文件最后几行
    print("\n文件最后 5 行:")
    for line in verify[-5:]:
        print(f"  {repr(line)}")
