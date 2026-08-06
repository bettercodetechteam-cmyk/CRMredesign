import { toast } from './use-toast';

// Base API configuration - dynamic based on environment
const API_BASE_URL = import.meta.env.PROD 
  ? `${window.location.origin}/api`
  : '/api';

const IMAGEKIT_AUTH_URL = import.meta.env.PROD
  ? `${window.location.origin}/auth`
  : '/auth';

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

// Generic API client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error(`API Error (${endpoint}):`, error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // GET request
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// Student API service
export class StudentApiService {
  async getAll(filters?: { centreId?: string; status?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/students', params);
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/students/${id}`);
  }

  async create(studentData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/students', studentData);
  }

  async update(id: string, studentData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/students/${id}`, studentData);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/students/${id}`);
  }
}

// Lead API service
export class LeadApiService {
  async getAll(filters?: { centreId?: string; status?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/leads', params);
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/leads/${id}`);
  }

  async create(leadData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/leads', leadData);
  }

  async update(id: string, leadData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/leads/${id}`, leadData);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/leads/${id}`);
  }

  async getStats(): Promise<ApiResponse<any>> {
    return apiClient.get('/leads/stats');
  }
}

// Course API service
export class CourseApiService {
  async getAll(page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params: any = {};
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/courses', params);
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/courses/${id}`);
  }
}

// Batch API service
export class BatchApiService {
  async getAll(filters?: { centreId?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/batches', params);
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/batches/${id}`);
  }

  async create(batchData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/batches', batchData);
  }

  async update(id: string, batchData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/batches/${id}`, batchData);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/batches/${id}`);
  }
}

// Fee API service
export class FeeApiService {
  async getAll(filters?: { studentId?: string; centreId?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/fees', params);
  }

  async create(feeData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/fees', feeData);
  }
}

// Assignment API service
export class AssignmentApiService {
  async getAll(filters?: { batchId?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/assignments', params);
  }

  async create(assignmentData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/assignments', assignmentData);
  }
}

// Staff API service
export class StaffApiService {
  async getAll(filters?: { centreId?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/staff', params);
  }

  async create(staffData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/staff', staffData);
  }
}

// Expense API service
export class ExpenseApiService {
  async getAll(filters?: { centreId?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/expenses', params);
  }

  async create(expenseData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/expenses', expenseData);
  }
}

// Target API service
export class TargetApiService {
  async getAll(filters?: { centreId?: string; assignedTo?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/targets', params);
  }

  async create(targetData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/targets', targetData);
  }

  async update(id: string, targetData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/targets/${id}`, targetData);
  }
}

// Performance API service
export class PerformanceApiService {
  async getAll(filters?: { centreId?: string; userId?: string }, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { ...filters };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/performance-metrics', params);
  }

  async getMetrics(filters?: { centreId?: string; period?: string }): Promise<ApiResponse<any>> {
    return apiClient.get('/performance/metrics', filters);
  }

  async getDashboardStats(): Promise<ApiResponse<any>> {
    return apiClient.get('/performance/dashboard-stats');
  }

  async create(metricData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/performance-metrics', metricData);
  }
}

// Notification API service
export class NotificationApiService {
  async getAll(userId: string, page?: number, pageSize?: number): Promise<ApiResponse<{
    data: any[];
    hasMore: boolean;
    total: number;
  }>> {
    const params = { userId };
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    return apiClient.get('/notifications', params);
  }

  async create(notificationData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/notifications', notificationData);
  }
}

// Dashboard API service
export class DashboardApiService {
  async getStats(): Promise<ApiResponse<any>> {
    return apiClient.get('/dashboard/stats');
  }
}

// ImageKit API service
export class ImageKitApiService {
  async getAuthParams(): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(IMAGEKIT_AUTH_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('ImageKit Auth Error:', error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get ImageKit auth params',
      };
    }
  }

  async listFiles(folder: string = '/'): Promise<ApiResponse<any>> {
    return apiClient.get('/files', { folder });
  }

  async deleteFile(fileId: string): Promise<ApiResponse<void>> {
    return apiClient.delete('/delete-file', { fileId });
  }

  async createFolder(folderPath: string): Promise<ApiResponse<void>> {
    return apiClient.post('/create-folder', { folderPath });
  }
}

// Export service instances
export const studentApi = new StudentApiService();
export const leadApi = new LeadApiService();
export const courseApi = new CourseApiService();
export const batchApi = new BatchApiService();
export const feeApi = new FeeApiService();
export const assignmentApi = new AssignmentApiService();
export const staffApi = new StaffApiService();
export const expenseApi = new ExpenseApiService();
export const targetApi = new TargetApiService();
export const performanceApi = new PerformanceApiService();
export const notificationApi = new NotificationApiService();
export const dashboardApi = new DashboardApiService();
export const imageKitApi = new ImageKitApiService();

// Utility functions for common operations
export const apiUtils = {
  // Handle API responses with toast notifications
  async handleApiCall<T>(
    apiCall: Promise<ApiResponse<T>>,
    successMessage?: string,
    errorMessage?: string
  ): Promise<T | null> {
    const response = await apiCall;
    
    if (response.success && response.data) {
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }
      return response.data;
    } else {
      const message = errorMessage || response.error || 'Operation failed';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return null;
    }
  },

  // Create with success/error handling
  async create<T>(
    createFn: (data: any) => Promise<ApiResponse<T>>,
    data: any,
    entityName: string
  ): Promise<T | null> {
    return this.handleApiCall(
      createFn(data),
      `${entityName} created successfully`,
      `Failed to create ${entityName.toLowerCase()}`
    );
  },

  // Update with success/error handling
  async update<T>(
    updateFn: (id: string, data: any) => Promise<ApiResponse<T>>,
    id: string,
    data: any,
    entityName: string
  ): Promise<T | null> {
    return this.handleApiCall(
      updateFn(id, data),
      `${entityName} updated successfully`,
      `Failed to update ${entityName.toLowerCase()}`
    );
  },

  // Delete with success/error handling
  async delete(
    deleteFn: (id: string) => Promise<ApiResponse<void>>,
    id: string,
    entityName: string
  ): Promise<boolean> {
    const result = await this.handleApiCall(
      deleteFn(id),
      `${entityName} deleted successfully`,
      `Failed to delete ${entityName.toLowerCase()}`
    );
    return result !== null;
  },
}; 