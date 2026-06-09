import { ROLE_OPTIONS, getRoleInfo } from '../utils/constants'

export default function RoleSwitcher({ currentRole, onSwitch }) {
  return (
    <div className="role-switcher">
      <span className="role-switcher-label">当前角色：</span>
      <div className="role-tabs">
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role.value}
            className={`role-tab ${currentRole === role.value ? 'active' : ''}`}
            onClick={() => onSwitch(role.value)}
            style={{
              borderColor: currentRole === role.value ? role.color : '#d9d9d9',
              color: currentRole === role.value ? role.color : '#666',
              background: currentRole === role.value ? `${role.color}15` : 'white',
            }}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  )
}
