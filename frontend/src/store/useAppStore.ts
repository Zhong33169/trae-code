import { create } from 'zustand';
import { Role } from '@/types';

interface CurrentUser {
  id: string;
  name: string;
}

const ROLE_USER_MAP: Record<Role, CurrentUser> = {
  [Role.Registrar]: { id: 'registrar-001', name: '张登记' },
  [Role.Reviewer]: { id: 'reviewer-001', name: '李审核' },
  [Role.FinalReviewer]: { id: 'final-reviewer-001', name: '王复核' },
};

interface AppState {
  currentRole: Role;
  currentUser: CurrentUser;
  setCurrentRole: (role: Role) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentRole: Role.Registrar,
  currentUser: ROLE_USER_MAP[Role.Registrar],
  setCurrentRole: (role: Role) =>
    set({ currentRole: role, currentUser: ROLE_USER_MAP[role] }),
}));
