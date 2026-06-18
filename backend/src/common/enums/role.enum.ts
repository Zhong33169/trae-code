export enum Role {
  REGISTRAR = 'registrar',
  SUPERVISOR = 'supervisor',
  SUPERVISOR_ENGINEER = 'supervisor_engineer',
}

export const RoleLabel: Record<Role, string> = {
  [Role.REGISTRAR]: '进度登记员',
  [Role.SUPERVISOR]: '进度审核主管',
  [Role.SUPERVISOR_ENGINEER]: '工程监理公司复核负责人',
};
