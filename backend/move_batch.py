
with open('reservations/api.py', 'r') as f:
    content = f.read()
    lines = content.splitlines(keepends=True)

print(f"总行数: {len(lines)}")

# 找到批量接口的起始位置
batch_start = None
for i, line in enumerate(lines):
    if "@api.post('/reservations/batch'" in line:
        batch_start = i
        break

print(f"批量接口起始行: {batch_start + 1}")

# 找到批量接口的结束位置（函数返回后）
batch_end = None
paren_count = 0
in_function = False
for i in range(batch_start, len(lines)):
    line = lines[i]
    if 'def batch_operation' in line:
        in_function = True
    if in_function:
        # 简单的方法：找到 return 语句后面的空行
        if line.strip().startswith('return '):
            # 找到 return 后面的第一个空行
            for j in range(i+1, len(lines)):
                if lines[j].strip() == '':
                    # 再检查后面是不是别的内容
                    if j+1 < len(lines) and lines[j+1].strip() != '':
                        batch_end = j
                        break
                    elif j+1 >= len(lines):
                        batch_end = j
                        break
            break

print(f"批量接口结束行: {batch_end + 1 if batch_end else None}")

if batch_end:
    # 提取批量接口代码
    batch_code = lines[batch_start:batch_end+1]
    print(f"批量接口代码行数: {len(batch_code)}")
    
    # 找到详情接口的位置（插入到详情接口前面）
    insert_pos = None
    for i, line in enumerate(lines):
        if "@api.get('/reservations/{reservation_id}'" in line:
            insert_pos = i
            # 找到前面的空行
            for j in range(i-1, -1, -1):
                if lines[j].strip() == '':
                    insert_pos = j
                    break
            break
    
    print(f"插入位置: {insert_pos + 1}")
    
    if insert_pos:
        # 构建新内容
        # 插入位置之前 + 批量代码 + 空行 + 插入位置之后（去掉原来的批量代码）
        before = lines[:insert_pos]
        after = lines[insert_pos:batch_start] + lines[batch_end+1:]
        
        new_lines = before + ['\n'] + batch_code + ['\n'] + after
        
        with open('reservations/api.py', 'w') as f:
            f.writelines(new_lines)
        
        print("完成！批量接口已移到详情接口前面")
