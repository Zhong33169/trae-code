
with open('backend/reservations/api.py', 'r') as f:
    lines = f.readlines()

print(f"总行数: {len(lines)}")

# 前半部分：第 496-514 行（索引 495-513）
batch_front_start = 495  # 0-based
batch_front_end = 513    # 0-based（包含这一行）

# 孤儿代码：第 1061-1317 行（索引 1060-1316）
orphan_start = 1060
orphan_end = 1316

print(f"前半部分: 行 {batch_front_start+1} - {batch_front_end+1}")
print(f"孤儿代码: 行 {orphan_start+1} - {orphan_end+1}")

# 提取各部分
before_front = lines[:batch_front_start]
front_part = lines[batch_front_start:batch_front_end + 1]
middle_part = lines[batch_front_end + 1:orphan_start]  # 详情接口等到孤儿代码之前
orphan_code = lines[orphan_start:orphan_end + 1]
after_orphan = lines[orphan_end + 1:]

print(f"前半部分之前: {len(before_front)} 行")
print(f"前半部分: {len(front_part)} 行")
print(f"中间部分: {len(middle_part)} 行")
print(f"孤儿代码: {len(orphan_code)} 行")
print(f"孤儿代码之后: {len(after_orphan)} 行")

# 合并：前半部分之前 + 前半部分 + 孤儿代码 + 空行 + 中间部分 + 孤儿代码之后
new_lines = before_front + front_part + orphan_code + ['\n', '\n'] + middle_part + after_orphan

print(f"新文件总行数: {len(new_lines)}")

# 写入
with open('backend/reservations/api.py', 'w') as f:
    f.writelines(new_lines)

print("修复完成！")

# 验证
with open('backend/reservations/api.py', 'r') as f:
    verify = f.readlines()

# 检查接口顺序
print("\n接口顺序:")
for i, line in enumerate(verify):
    if '@api.' in line and '/reservation' in line:
        print(f"  行{i+1}: {line.strip()[:90]}")

# 检查批量接口函数是否完整
print("\n批量接口函数检查:")
batch_func_start = None
batch_func_end = None
for i, line in enumerate(verify):
    if 'def batch_operation' in line:
        batch_func_start = i
    if batch_func_start is not None and 'return {' in line:
        # 找到最后的 return
        batch_func_end = i

if batch_func_start and batch_func_end:
    print(f"  函数定义: 行 {batch_func_start+1}")
    print(f"  最后 return: 行 {batch_func_end+1}")
    print(f"  函数长度: {batch_func_end - batch_func_start + 1} 行")
