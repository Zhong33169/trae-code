export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  role_label: string;
  created_at: string;
}

const currentUser = ref<User | null>(null);
const users = ref<User[]>([]);

export const useAuth = () => {
  const loadUsers = async () => {
    try {
      const { get } = useApi();
      const res: any = await get('/users');
      users.value = res.data;
      
      const savedUserId = localStorage.getItem('currentUserId');
      if (savedUserId) {
        const user = users.value.find(u => u.id === savedUserId);
        if (user) {
          currentUser.value = user;
        }
      } else if (users.value.length > 0) {
        currentUser.value = users.value[0];
        localStorage.setItem('currentUserId', users.value[0].id);
      }
    } catch (e) {
      console.error('加载用户失败', e);
    }
  };

  const switchUser = (userId: string) => {
    const user = users.value.find(u => u.id === userId);
    if (user) {
      currentUser.value = user;
      localStorage.setItem('currentUserId', userId);
    }
  };

  const isRegistrar = computed(() => currentUser.value?.role === 'registrar');
  const isAuditor = computed(() => currentUser.value?.role === 'auditor');
  const isReviewer = computed(() => currentUser.value?.role === 'reviewer');

  return {
    currentUser,
    users,
    loadUsers,
    switchUser,
    isRegistrar,
    isAuditor,
    isReviewer,
  };
};
