
with open('backend/reservations/api.py', 'r') as f:
    lines = f.readlines()

print(f"总行数: {len(lines)}")

# 找到补录接口（supplement-evidence）的结束位置
# 这是批量接口之前的最后一个接口
supplement_end = None
for i, line in enumerate(lines):
    if "return reservation_to_detail(reservation, user)" in line:
        # 检查前面是不是补录接口
        for j in range(i, max(0, i-50), -1):
            if 'supplement-evidence' in lines[j]:
                supplement_end = i
                break
        if supplement_end:
            break

print(f"补录接口结束行: {supplement_end + 1 if supplement_end else None}")

# 找到批量接口后半部分的起始位置
batch_half_start = None
for i in range(supplement_end + 1 if supplement_end else 0, len(lines)):
    if "valid_operations = ['lab_review_pass'" in lines[i]:
        batch_half_start = i
        break

print(f"批量接口后半部分起始行: {batch_half_start + 1 if batch_half_start else None}")

# 找到批量接口后半部分的结束位置
# 也就是文件倒数几行的位置（应该是 return 语句）
batch_half_end = None
for i in range(len(lines)-1, -1, -1):
    if lines[i].strip().startswith("'results': results,"):
        # 往上找 return 语句
        for j in range(i, -1, -1):
            if lines[j].strip() == 'return {':
                batch_half_end = i + 2  # return { 后面还有几行
                break
        break

if not batch_half_end:
    # 试试找最后一个 return 语句
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip().startswith('return ') and 'reservation_to_detail' not in lines[i]:
            batch_half_end = i
            break

print(f"批量接口后半部分结束行: {batch_half_end + 1 if batch_half_end else None}")

if batch_half_start and batch_half_end and supplement_end:
    # 提取批量接口后半部分
    batch_half = lines[batch_half_start:batch_half_end+1]
    print(f"后半部分代码行数: {len(batch_half)}")
    
    # 找到前半部分的结束位置（第一个 return 后面）
    batch_first_end = None
    for i in range(490, 530):
        if lines[i].strip() == '' and i > 505:
            # 找到详情接口之前的空行
            if '@api.get' in lines[i+1] or i+1 >= len(lines):
                batch_first_end = i
                break
    
    print(f"前半部分结束行: {batch_first_end + 1 if batch_first_end else None}")
    
    if batch_first_end:
        # 构建新文件
        # 前半部分之前的内容 + 前半部分 + 后半部分 + 空行 + 中间内容（详情接口等到补录接口） + 后半部分之后的内容
        before = lines[:batch_first_end + 1]
        middle = lines[batch_first_end + 1:batch_half_start]  # 详情接口等到补录接口
        after = lines[batch_half_end + 1:]
        
        # 检查后半部分的缩进是否正确
        # 前半部分的函数体缩进应该是 4 个空格
        # 后半部分也应该是 4 个空格缩进
        
        print("\n后半部分前5行:")
        for line in batch_half[:5]:
            print(f"  {repr(line)}")
        
        new_lines = before + batch_half + ['\n', '\n'] + middle + after
        
        with open('backend/reservations/api.py', 'w') as f:
            f.writelines(new_lines)
        
        print(f"\n修复完成！新文件总行数: {len(new_lines)}")
        
        # 验证批量接口
        with open('backend/reservations/api.py', 'r') as f:
            verify_lines = f.readlines()
        
        batch_count = 0
        for i, line in enumerate(verify_lines):
            if 'batch' in line.lower() and ('def ' in line or '@api' in line):
                print(f"  行{i+1}: {line.strip()[:80]}")
                batch_count += 1
