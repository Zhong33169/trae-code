export const useApi = () => {
  const config = useRuntimeConfig();
  const token = useCookie('auth_token');

  const defaultHeaders = computed(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`;
    }
    return headers;
  });

  const request = async <T>(
    url: string,
    options: any = {},
  ): Promise<T> => {
    try {
      const data = await $fetch<T>(`${config.public.apiBase}${url}`, {
        ...options,
        headers: {
          ...defaultHeaders.value,
          ...options.headers,
        },
      });
      return data;
    } catch (error: any) {
      if (error.status === 401) {
        token.value = null;
        navigateTo('/login');
      }
      throw error;
    }
  };

  return {
    get: <T>(url: string, params?: any) => request<T>(url, { method: 'GET', query: params }),
    post: <T>(url: string, body?: any) => request<T>(url, { method: 'POST', body }),
    put: <T>(url: string, body?: any) => request<T>(url, { method: 'PUT', body }),
    delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
    upload: <T>(url: string, formData: FormData) => {
      const headers: Record<string, string> = {};
      if (token.value) {
        headers['Authorization'] = `Bearer ${token.value}`;
      }
      return $fetch<T>(`${config.public.apiBase}${url}`, {
        method: 'POST',
        body: formData,
        headers,
      });
    },
  };
};
