const express = require('express');
const router = express.Router();
const store = require('../data/store');

const ROLE_MAP = {
  registrar: '生产登记员',
  auditor: '生产审核主管',
  reviewer: '制造工厂复核负责人'
};

router.post('/login', (req, res) => {
  const { userId, role } = req.body;
  
  if (!userId || !role) {
    return res.status(400).json({
      success: false,
      message: '用户ID和岗位不能为空'
    });
  }

  if (!ROLE_MAP[role]) {
    return res.status(400).json({
      success: false,
      message: '无效的岗位类型',
      code: 'INVALID_ROLE'
    });
  }

  const user = store.users.find(u => u.id === userId && u.role === role);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在或岗位不匹配',
      code: 'USER_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        roleName: user.roleName
      },
      permissions: getPermissions(role)
    }
  });
});

router.get('/users', (req, res) => {
  const { role } = req.query;
  let users = store.users;
  
  if (role) {
    users = users.filter(u => u.role === role);
  }

  res.json({
    success: true,
    data: users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      roleName: u.roleName
    }))
  });
});

router.get('/roles', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(ROLE_MAP).map(([key, value]) => ({
      role: key,
      roleName: value
    }))
  });
});

function getPermissions(role) {
  const perms = {
    registrar: [
      'workorder:create',
      'workorder:submit',
      'workorder:rework',
      'workorder:view:own',
      'workorder:scan',
      'workorder:batch:rework'
    ],
    auditor: [
      'workorder:audit',
      'workorder:reject',
      'workorder:view:all',
      'workorder:scan',
      'workorder:batch:audit'
    ],
    reviewer: [
      'workorder:review',
      'workorder:archive',
      'workorder:reject',
      'workorder:view:all',
      'workorder:scan',
      'workorder:batch:review',
      'audit:view'
    ]
  };
  return perms[role] || [];
}

module.exports = router;
