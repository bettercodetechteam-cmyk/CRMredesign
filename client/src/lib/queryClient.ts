import { QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast"; // your existing imports

// Helper function to check if error is unauthorized
function isUnauthorizedError(error: any): boolean {
  return error.message && error.message.includes('401');
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey, signal }) => {
        const res = await fetch(queryKey[0] as string, { 
          signal,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error(`${res.status}: ${res.statusText}`);
          }
          if (res.status === 401) {
            throw new Error(`401: ${res.statusText} - Unauthorized`);
          }
          if (res.status === 403) {
            throw new Error(`403: ${res.statusText} - Access denied for current role`);
          }
          throw new Error(`${res.status}: ${res.statusText}`);
        }

        return res.json();
      },
      retry: (failureCount, error) => {
        if (isUnauthorizedError(error) || error.message.includes('403')) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export async function apiRequest(method: string, url: string, data?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    if (response.status === 401) {
      throw new Error(`401: ${response.statusText} - Unauthorized`);
    }
    if (response.status === 403) {
      throw new Error(`403: ${response.statusText} - Access denied for current role`);
    }
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}
