import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry the original request
            return this.client.request(error.config);
          } else {
            // Refresh failed, logout
            this.clearTokens();
            window.location.href = "/auth/login";
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_token");
    }
    return null;
  }

  private getRefreshToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_refresh_token");
    }
    return null;
  }

  private setTokens(accessToken: string, refreshToken: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_token", accessToken);
      localStorage.setItem("admin_refresh_token", refreshToken);
    }
  }

  private clearTokens() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("admin_user");
    }
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await axios.post(`${API_URL}/admin/auth/refresh`, {
        refreshToken,
      });

      if (response.data.accessToken && response.data.refreshToken) {
        this.setTokens(response.data.accessToken, response.data.refreshToken);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Auth methods
  async login(email: string, password: string) {
    const response = await this.client.post("/admin/auth/login", {
      email,
      password,
    });
    if (response.data.accessToken && response.data.refreshToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      if (response.data.user) {
        localStorage.setItem("admin_user", JSON.stringify(response.data.user));
      }
    }
    return response.data;
  }

  async logout() {
    try {
      await this.client.post("/admin/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.clearTokens();
    }
  }

  async getMe() {
    const response = await this.client.get("/admin/auth/me");
    return response.data;
  }

  // Dashboard
  async getDashboard() {
    const response = await this.client.get("/admin/dashboard");
    return response.data;
  }

  // Users
  async getUsers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    city?: string;
    institution?: string;
    search?: string;
  }) {
    const response = await this.client.get("/admin/users", { params });
    return response.data;
  }

  async getUser(id: string) {
    const response = await this.client.get(`/admin/users/${id}`);
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.client.patch(`/admin/users/${id}`, data);
    return response.data;
  }

  async muteUser(id: string, duration: string, reason: string) {
    const response = await this.client.post(`/admin/users/${id}/mute`, {
      duration,
      reason,
    });
    return response.data;
  }

  async banUser(id: string, reason: string) {
    const response = await this.client.post(`/admin/users/${id}/ban`, {
      reason,
    });
    return response.data;
  }

  async unbanUser(id: string) {
    const response = await this.client.post(`/admin/users/${id}/unban`);
    return response.data;
  }

  async verifyUser(id: string, badge: string) {
    const response = await this.client.post(`/admin/users/${id}/verify`, {
      badge,
    });
    return response.data;
  }

  // Groups
  async getGroups(params?: {
    page?: number;
    limit?: number;
    visibility?: string;
    category?: string;
    city?: string;
    search?: string;
  }) {
    const response = await this.client.get("/admin/groups", { params });
    return response.data;
  }

  async getGroup(id: string) {
    const response = await this.client.get(`/admin/groups/${id}`);
    return response.data;
  }

  async updateGroup(id: string, data: any) {
    const response = await this.client.patch(`/admin/groups/${id}`, data);
    return response.data;
  }

  async deleteGroup(id: string, reason: string, hardDelete = false) {
    const response = await this.client.delete(`/admin/groups/${id}`, {
      data: { reason, hardDelete },
    });
    return response.data;
  }

  async verifyGroup(id: string) {
    const response = await this.client.post(`/admin/groups/${id}/verify`);
    return response.data;
  }

  async getGroupMembers(id: string, params?: { page?: number; limit?: number }) {
    const response = await this.client.get(`/admin/groups/${id}/members`, {
      params,
    });
    return response.data;
  }

  async removeGroupMember(groupId: string, userId: string) {
    const response = await this.client.delete(
      `/admin/groups/${groupId}/members/${userId}`
    );
    return response.data;
  }

  // Reports & Moderation
  async getReports(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }) {
    const response = await this.client.get("/admin/reports", { params });
    return response.data;
  }

  async getReport(id: string) {
    const response = await this.client.get(`/admin/reports/${id}`);
    return response.data;
  }

  async resolveReport(id: string, data: {
    action: string;
    notes: string;
    notifyReporter: boolean;
  }) {
    const response = await this.client.post(`/admin/reports/${id}/resolve`, data);
    return response.data;
  }

  async dismissReport(id: string, reason: string) {
    const response = await this.client.post(`/admin/reports/${id}/dismiss`, {
      reason,
    });
    return response.data;
  }

  // Analytics
  async getAnalyticsOverview() {
    const response = await this.client.get("/admin/analytics/overview");
    return response.data;
  }

  async getGrowthMetrics(days = 30) {
    const response = await this.client.get("/admin/analytics/growth", {
      params: { days },
    });
    return response.data;
  }

  async getCityMetrics() {
    const response = await this.client.get("/admin/analytics/cities");
    return response.data;
  }

  async getInstitutionMetrics() {
    const response = await this.client.get("/admin/analytics/institutions");
    return response.data;
  }

  // Audit Logs
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    admin?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await this.client.get("/admin/action-logs", { params });
    return response.data;
  }

  // Security
  async getSecurityAlerts() {
    const response = await this.client.get("/admin/security/alerts");
    return response.data;
  }

  async getFailedLogins() {
    const response = await this.client.get("/admin/security/failed-logins");
    return response.data;
  }

  async updateRateLimits(data: any) {
    const response = await this.client.patch("/admin/security/rate-limits", data);
    return response.data;
  }

  async getRateLimits() {
    const response = await this.client.get("/admin/security/rate-limits");
    return response.data;
  }

  async getBlockedKeywords() {
    const response = await this.client.get("/admin/security/blocked-keywords");
    return response.data;
  }

  async addBlockedKeyword(keyword: string, matchType: string) {
    const response = await this.client.post("/admin/security/blocked-keywords", {
      keyword,
      matchType,
    });
    return response.data;
  }

  async deleteBlockedKeyword(id: string) {
    const response = await this.client.delete(
      `/admin/security/blocked-keywords/${id}`
    );
    return response.data;
  }

  // Admin Management
  async getAdmins() {
    const response = await this.client.get("/admin/security/admins");
    return response.data;
  }

  async createAdmin(data: {
    email: string;
    role: string;
    tempPassword: string;
  }) {
    const response = await this.client.post("/admin/security/admins", data);
    return response.data;
  }

  async deleteAdmin(id: string) {
    const response = await this.client.delete(`/admin/security/admins/${id}`);
    return response.data;
  }

  // Settings
  async getSettings() {
    const response = await this.client.get("/admin/settings");
    return response.data;
  }

  async updateSettings(data: any) {
    const response = await this.client.patch("/admin/settings", data);
    return response.data;
  }

  // Database Operations (Direct Supabase)
  async executeQuery(query: string) {
    const response = await this.client.post("/admin/database/query", { query });
    return response.data;
  }

  async getTables() {
    const response = await this.client.get("/admin/database/tables");
    return response.data;
  }

  async getTableData(table: string, params?: {
    page?: number;
    limit?: number;
    orderBy?: string;
  }) {
    const response = await this.client.get(`/admin/database/tables/${table}`, {
      params,
    });
    return response.data;
  }

  async updateTableRow(table: string, id: string, data: any) {
    const response = await this.client.patch(
      `/admin/database/tables/${table}/${id}`,
      data
    );
    return response.data;
  }

  async deleteTableRow(table: string, id: string) {
    const response = await this.client.delete(
      `/admin/database/tables/${table}/${id}`
    );
    return response.data;
  }

  // System Control
  async getSystemStatus() {
    const response = await this.client.get("/admin/system/status");
    return response.data;
  }

  async restartBackend() {
    const response = await this.client.post("/admin/system/restart");
    return response.data;
  }

  async getSystemLogs(params?: { lines?: number; level?: string }) {
    const response = await this.client.get("/admin/system/logs", { params });
    return response.data;
  }

  async clearCache() {
    const response = await this.client.post("/admin/system/cache/clear");
    return response.data;
  }

  // Error Tracking
  async getErrors(params?: {
    page?: number;
    limit?: number;
    level?: string;
    userId?: string;
  }) {
    const response = await this.client.get("/admin/errors", { params });
    return response.data;
  }

  async getError(id: string) {
    const response = await this.client.get(`/admin/errors/${id}`);
    return response.data;
  }

  async markErrorResolved(id: string) {
    const response = await this.client.post(`/admin/errors/${id}/resolve`);
    return response.data;
  }
}

export const api = new ApiClient();
