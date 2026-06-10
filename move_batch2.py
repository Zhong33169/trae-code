
with open('backend/reservations/api.py', 'r') as f:
    lines = f.readlines()

print(f"总行数: {len(lines)}")

# 找到批量接口的起始位置
batch_start = None
for i, line in enumerate(lines):
    if "@api.post('/reservations/batch'" in line:
        batch_start = i
        break

print(f"批量接口装饰器起始行: {batch_start + 1}")

# 找到批量接口函数的结束位置
# 函数体是缩进的，结束于下一个非空且无缩进的行
batch_end = None
in_function = False
func_indent = None
for i in range(batch_start, len(lines)):
    line = lines[i]
    stripped = line.strip()
    
    if not in_function:
        if 'def batch_operation' in line:
            in_function = True
            # 计算函数定义的缩进
            func_indent = len(line) - len(line.lstrip())
        continue
    
    # 在函数内部
    if stripped == '' or stripped.startswith('#'):
        continue
    
    current_indent = len(line) - len(line.lstrip())
    if current_indent <= func_indent and stripped:
        # 找到了比函数定义缩进还小的非空行，函数结束了
        # 回退到上一个非空行
        for j in range(i-1, batch_start, -1):
            if lines[j].strip():
                batch_end = j
                break
        break

if batch_end:
    print(f"批量接口结束行: {batch_end + 1}")
    print(f"批量接口代码行数: {batch_end - batch_start + 1}")
    
    # 提取批量接口代码（包括后面的空行）
    # 找到结束行后面的空行
    actual_end = batch_end
    for j in range(batch_end + 1, len(lines)):
        if lines[j].strip() == '':
            actual_end = j
        else:
            break
    
    print(f"包含尾部空行的结束行: {actual_end + 1}")
    
    batch_code = lines[batch_start:actual_end + 1]
    print(f"提取代码行数: {len(batch_code)}")
    
    # 找到插入位置（列表接口后面，详情接口前面）
    insert_pos = None
    for i, line in enumerate(lines):
        if "@api.get('/reservations/{reservation_id}'" in line:
            insert_pos = i
            # 往前找空行
            for j in range(i-1, -1, -1):
                if lines[j].strip() == '':
                    insert_pos = j + 1
                    break
            break
    
    print(f"插入位置行: {insert_pos + 1 if insert_pos else None}")
    
    if insert_pos:
        # 构建新文件
        # 插入位置之前的内容
        before = lines[:insert_pos]
        # 插入位置到批量接口开始之前的内容（即原来在批量接口前面的详情接口等）
        middle = lines[insert_pos:batch_start]
        # 批量接口之后的内容
        after = lines[actual_end + 1:]
        
        new_lines = before + ['\n'] + batch_code + ['\n'] + middle + after
        
        with open('backend/reservations/api.py', 'w') as f:
            f.writelines(new_lines)
        
        print("完成！批量接口已移到详情接口前面")
        
        # 验证
        with open('backend/reservations/api.py', 'r') as f:
            verify_lines = f.readlines()
        print(f"新文件总行数: {len(verify_lines)}")
        
        # 检查接口顺序
        for i, line in enumerate(verify_lines):
            if '@api.' in line and '/reservation' in line:
                print(f"  行{i+1}: {line.strip()[:80]}")
