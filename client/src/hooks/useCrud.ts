import { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/use-toast';
import { 
  studentApi, 
  leadApi, 
  courseApi, 
  batchApi, 
  feeApi, 
  assignmentApi, 
  staffApi, 
  expenseApi, 
  targetApi, 
  performanceApi, 
  notificationApi,
  imageKitApi,
  apiUtils,
  type ApiResponse 
} from '../lib/apiService';

// Generic CRUD hook interface with pagination
interface UseCrudState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    total: number;
  };
}

interface UseCrudActions<T> {
  create: (data: any) => Promise<T | null>;
  update: (id: string, data: any) => Promise<T | null>;
  delete: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  setData: (data: T[]) => void;
  loadMore: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

// Single item CRUD hook interface
interface UseSingleItemState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseSingleItemActions<T> {
  fetch: (id: string) => Promise<T | null>;
  update: (data: any) => Promise<T | null>;
  delete: () => Promise<boolean>;
  setData: (data: T | null) => void;
}

// Generic CRUD hook for collections with pagination
export function useCrud<T>(
  apiService: {
    getAll: (filters?: any, page?: number, pageSize?: number) => Promise<ApiResponse<{
      data: T[];
      hasMore: boolean;
      total: number;
    }>>;
    create: (data: any) => Promise<ApiResponse<T>>;
    update: (id: string, data: any) => Promise<ApiResponse<T>>;
    delete: (id: string) => Promise<ApiResponse<void>>;
  },
  filters?: Record<string, any>,
  entityName: string = 'Item',
  initialPageSize: number = 20
): [UseCrudState<T>, UseCrudActions<T>] {
  const [state, setState] = useState<UseCrudState<T>>({
    data: [],
    loading: true,
    error: null,
    refreshing: false,
    pagination: {
      page: 1,
      pageSize: initialPageSize,
      hasMore: false,
      total: 0,
    },
  });

  const fetchData = useCallback(async (isRefreshing = false, page = 1, append = false) => {
    try {
      setState(prev => ({
        ...prev,
        loading: !isRefreshing && !append,
        refreshing: isRefreshing,
        error: null,
      }));

      const response = await apiService.getAll(filters, page, state.pagination.pageSize);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          data: append ? [...prev.data, ...response.data.data] : response.data.data,
          loading: false,
          refreshing: false,
          error: null,
          pagination: {
            ...prev.pagination,
            page,
            hasMore: response.data.hasMore,
            total: response.data.total,
          },
        }));
      } else {
        throw new Error(response.error || 'Failed to fetch data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
      
      toast({
        title: "Error",
        description: `Failed to fetch ${entityName.toLowerCase()}s`,
        variant: "destructive",
      });
    }
  }, [apiService, filters, entityName, state.pagination.pageSize]);

  const create = useCallback(async (data: any): Promise<T | null> => {
    const result = await apiUtils.create(
      (createData) => apiService.create(createData),
      data,
      entityName
    );
    
    if (result) {
      // Refresh data after creation
      await fetchData(false, 1, false);
    }
    
    return result;
  }, [apiService, entityName, fetchData]);

  const update = useCallback(async (id: string, data: any): Promise<T | null> => {
    const result = await apiUtils.update(
      (updateId, updateData) => apiService.update(updateId, updateData),
      id,
      data,
      entityName
    );
    
    if (result) {
      // Refresh data after update
      await fetchData(false, 1, false);
    }
    
    return result;
  }, [apiService, entityName, fetchData]);

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    const result = await apiUtils.delete(
      (deleteId) => apiService.delete(deleteId),
      id,
      entityName
    );
    
    if (result) {
      // Refresh data after deletion
      await fetchData(false, 1, false);
    }
    
    return result;
  }, [apiService, entityName, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true, 1, false);
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (state.pagination.hasMore && !state.loading) {
      const nextPage = state.pagination.page + 1;
      await fetchData(false, nextPage, true);
    }
  }, [fetchData, state.pagination.hasMore, state.pagination.page, state.loading]);

  const setPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        page,
      },
    }));
    fetchData(false, page, false);
  }, [fetchData]);

  const setPageSize = useCallback((pageSize: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        pageSize,
        page: 1, // Reset to first page when changing page size
      },
    }));
    fetchData(false, 1, false);
  }, [fetchData]);

  const setData = useCallback((data: T[]) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return [
    state,
    {
      create,
      update,
      delete: deleteItem,
      refresh,
      setData,
      loadMore,
      setPage,
      setPageSize,
    },
  ];
}

// Single item CRUD hook
export function useSingleItem<T>(
  apiService: {
    getById: (id: string) => Promise<ApiResponse<T>>;
    update: (id: string, data: any) => Promise<ApiResponse<T>>;
    delete: (id: string) => Promise<ApiResponse<void>>;
  },
  entityName: string = 'Item'
): [UseSingleItemState<T>, UseSingleItemActions<T>] {
  const [state, setState] = useState<UseSingleItemState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(async (id: string): Promise<T | null> => {
    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      const response = await apiService.getById(id);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          data: response.data,
          loading: false,
          error: null,
        }));
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      
      toast({
        title: "Error",
        description: `Failed to fetch ${entityName.toLowerCase()}`,
        variant: "destructive",
      });
      return null;
    }
  }, [apiService, entityName]);

  const update = useCallback(async (data: any): Promise<T | null> => {
    if (!state.data) return null;
    
    return apiUtils.update(
      (id, updateData) => apiService.update(id, updateData),
      (state.data as any).id,
      data,
      entityName
    );
  }, [apiService, entityName, state.data]);

  const deleteItem = useCallback(async (): Promise<boolean> => {
    if (!state.data) return false;
    
    return apiUtils.delete(
      (id) => apiService.delete(id),
      (state.data as any).id,
      entityName
    );
  }, [apiService, entityName, state.data]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  return [
    state,
    {
      fetch,
      update,
      delete: deleteItem,
      setData,
    },
  ];
}

// Specific CRUD hooks for each entity type
export function useStudents(filters?: { centreId?: string; status?: string }, pageSize: number = 20) {
  return useCrud(studentApi, filters, 'Student', pageSize);
}

export function useLeads(filters?: { centreId?: string; status?: string }, pageSize: number = 20) {
  return useCrud(leadApi, filters, 'Lead', pageSize);
}

export function useCourses(pageSize: number = 20) {
  return useCrud(courseApi, undefined, 'Course', pageSize);
}

export function useBatches(filters?: { centreId?: string }, pageSize: number = 20) {
  return useCrud(batchApi, filters, 'Batch', pageSize);
}

export function useFees(filters?: { studentId?: string; centreId?: string }, pageSize: number = 20) {
  return useCrud(feeApi, filters, 'Fee', pageSize);
}

export function useAssignments(filters?: { batchId?: string }, pageSize: number = 20) {
  return useCrud(assignmentApi, filters, 'Assignment', pageSize);
}

export function useStaff(filters?: { centreId?: string }, pageSize: number = 20) {
  return useCrud(staffApi, filters, 'Staff', pageSize);
}

export function useExpenses(filters?: { centreId?: string }, pageSize: number = 20) {
  return useCrud(expenseApi, filters, 'Expense', pageSize);
}

export function useTargets(filters?: { centreId?: string; assignedTo?: string }, pageSize: number = 20) {
  return useCrud(targetApi, filters, 'Target', pageSize);
}

export function usePerformanceMetrics(filters?: { centreId?: string; userId?: string }, pageSize: number = 20) {
  return useCrud(performanceApi, filters, 'Performance Metric', pageSize);
}

export function useNotifications(userId: string, pageSize: number = 20) {
  return useCrud(notificationApi, { userId }, 'Notification', pageSize);
}

// Single item hooks
export function useStudent() {
  return useSingleItem(studentApi, 'Student');
}

export function useLead() {
  return useSingleItem(leadApi, 'Lead');
}

export function useCourse() {
  return useSingleItem(courseApi, 'Course');
}

export function useBatch() {
  return useSingleItem(batchApi, 'Batch');
}

// ImageKit hook
export function useImageKit() {
  const [authParams, setAuthParams] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthParams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await imageKitApi.getAuthParams();
      
      if (response.success && response.data) {
        setAuthParams(response.data);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get auth params');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: "Failed to get ImageKit authentication parameters",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listFiles = useCallback(async (folder: string = '/') => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await imageKitApi.listFiles(folder);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list files');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: "Failed to list files",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await imageKitApi.deleteFile(fileId);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "File deleted successfully",
        });
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete file');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (folderPath: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await imageKitApi.createFolder(folderPath);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Folder created successfully",
        });
        return true;
      } else {
        throw new Error(response.error || 'Failed to create folder');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    authParams,
    loading,
    error,
    getAuthParams,
    listFiles,
    deleteFile,
    createFolder,
  };
} 