export enum Role {
  REGISTRAR = 'registrar',
  SUPERVISOR = 'supervisor',
  REVIEWER = 'reviewer'
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const RoleLabels: Record<Role, string> = {
  [Role.REGISTRAR]: '发布登记员',
  [Role.SUPERVISOR]: '发布审核主管',
  [Role.REVIEWER]: '复核负责人'
};
