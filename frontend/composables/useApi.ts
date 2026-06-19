export const useApi = () => {
  const config = useRuntimeConfig();
  const { currentUser } = useAuth();

  const request = async <T>(url: string, options: any = {}): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (currentUser.value) {
      headers['x-user-id'] = currentUser.value.id;
    }

    const response = await $fetch<T>(`${config.public.apiBase}${url}`, {
      ...options,
      headers,
    });

    return response;
  };

  const get = <T>(url: string, params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request<T>(`${url}${query}`, { method: 'GET' });
  };

  const post = <T>(url: string, body?: any) => {
    return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
  };

  const put = <T>(url: string, body?: any) => {
    return request<T>(url, { method: 'PUT', body: JSON.stringify(body) });
  };

  const del = <T>(url: string) => {
    return request<T>(url, { method: 'DELETE' });
  };

  return { get, post, put, del };
};
