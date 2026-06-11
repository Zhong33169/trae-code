const validateRequired = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return `${fieldName}不能为空`;
  }
  return null;
};

const validateLength = (value, fieldName, min, max) => {
  if (value && typeof value === 'string') {
    if (min !== undefined && value.length < min) {
      return `${fieldName}长度不能少于${min}个字符`;
    }
    if (max !== undefined && value.length > max) {
      return `${fieldName}长度不能超过${max}个字符`;
    }
  }
  return null;
};

const validateNumber = (value, fieldName, min, max) => {
  if (value !== undefined && value !== null) {
    const num = Number(value);
    if (isNaN(num)) {
      return `${fieldName}必须是数字`;
    }
    if (min !== undefined && num < min) {
      return `${fieldName}不能小于${min}`;
    }
    if (max !== undefined && num > max) {
      return `${fieldName}不能大于${max}`;
    }
  }
  return null;
};

const validateDate = (value, fieldName) => {
  if (value) {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      return `${fieldName}日期格式不正确`;
    }
  }
  return null;
};

const validateObject = (obj, schema) => {
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];
    for (const rule of rules) {
      let err = null;
      switch (rule.type) {
        case 'required':
          err = validateRequired(value, rule.label || field);
          break;
        case 'length':
          err = validateLength(value, rule.label || field, rule.min, rule.max);
          break;
        case 'number':
          err = validateNumber(value, rule.label || field, rule.min, rule.max);
          break;
        case 'date':
          err = validateDate(value, rule.label || field);
          break;
        case 'custom':
          if (rule.validator) {
            err = rule.validator(value, obj);
          }
          break;
      }
      if (err) {
        errors.push({ field, message: err });
        break;
      }
    }
  }
  return errors.length > 0 ? errors : null;
};

module.exports = {
  validateRequired,
  validateLength,
  validateNumber,
  validateDate,
  validateObject,
};
