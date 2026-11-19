import {
  AuthStatus,
  Deployment,
  DetectionResult,
  EnvVariable,
  FrameworkTemplate,
  GitHubRepo,
  MonitoringData,
  OverviewStats,
  Project,
  TunnelStatus,
  User,
} from "./types";

const TOKEN_KEY = "deployforge_token";

export function getToken(): string | null {
  // Check hash first for oauth redirect
  const hashMatch = window.location.hash.match(/token=([^&]+)/);
  if (hashMatch) {
    const token = hashMatch[1];
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("t", token);
    window.history.replaceState(null, "", window.location.pathname);
    return token;
  }
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("t");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("t", token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("t");
  }
}

type AuthChangeHandler = (authed: boolean) => void;
const authListeners: AuthChangeHandler[] = [];

export function onAuthChange(handler: AuthChangeHandler) {
  authListeners.push(handler);
  return () => {
    const idx = authListeners.indexOf(handler);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

function notifyAuth(authed: boolean) {
  authListeners.forEach((fn) => fn(authed));
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    notifyAuth(false);
    throw new Error("Session expired. Please sign in again.");
  }

  if (res.status === 204) {
    return null as T;
  }

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const errJson = await res.json();
      errMsg = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  getAuthStatus: () => request<AuthStatus>("/auth/status"),
  devLogin: async () => {
    const data = await request<{ token: string; user: any }>("/auth/dev", { method: "POST" });
    setToken(data.token);
    notifyAuth(true);
    return data;
  },
  logout: () => {
    setToken(null);
    notifyAuth(false);
  },
  getMe: () => request<User>("/me"),

  // Overview & Monitoring
  getOverview: () => request<OverviewStats>("/overview"),
  getMonitoring: () => request<MonitoringData>("/monitoring"),

  // Projects
  getProjects: () => request<Project[]>("/projects"),
  getProject: (id: number) => request<Project>(`/projects/${id}`),
  createProject: (data: Partial<Project>) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  deployProject: (id: number) => request<{ id: number }>(`/projects/${id}/deploy`, { method: "POST" }),
  deployLocal: (id: number) =>
    request<{ id: number; deployment_mode: string }>(`/projects/${id}/deploy/local`, { method: "POST" }),
  deployPublic: (id: number) =>
    request<{ id: number; deployment_mode: string }>(`/projects/${id}/deploy/public`, { method: "POST" }),
  getTunnelStatus: (id: number) => request<TunnelStatus>(`/projects/${id}/tunnel`),
  startTunnel: (id: number) =>
    request<{ status: string; public_url: string | null; deployment_mode: string }>(`/projects/${id}/tunnel/start`, {
      method: "POST",
    }),
  stopTunnel: (id: number) =>
    request<{ stopped: boolean; tunnel_status: string }>(`/projects/${id}/tunnel/stop`, { method: "POST" }),
  restartTunnel: (id: number) =>
    request<{ status: string; public_url: string | null; deployment_mode: string }>(`/projects/${id}/tunnel/restart`, {
      method: "POST",
    }),
  restartProject: (id: number) => request<{ restarted: boolean }>(`/projects/${id}/restart`, { method: "POST" }),
  stopProject: (id: number) => request<{ stopped: boolean }>(`/projects/${id}/stop`, { method: "POST" }),
  getProjectStats: (id: number) => request<any>(`/projects/${id}/stats`),

  // Deployments
  getDeployments: (projectId: number) => request<Deployment[]>(`/projects/${projectId}/deployments`),
  rollbackDeployment: (deploymentId: number) =>
    request<{ id: number }>(`/deployments/${deploymentId}/rollback`, { method: "POST" }),

  // Dockerfile Generator & Detection
  detectRepo: (body: { repo?: string; branch?: string; root_dir?: string; template?: string }) =>
    request<DetectionResult>("/detect", { method: "POST", body: JSON.stringify(body) }),
  getTemplates: () => request<FrameworkTemplate[]>("/templates"),
  validateDockerfile: (dockerfile: string) =>
    request<{ valid: boolean; errors: string[]; warnings: string[] }>("/validate-dockerfile", {
      method: "POST",
      body: JSON.stringify({ dockerfile }),
    }),

  // GitHub Repos
  getGitHubRepos: () => request<GitHubRepo[]>("/github/repos"),

  // Environment Variables
  getEnvVars: (projectId: number) => request<EnvVariable[]>(`/projects/${projectId}/env`),
  setEnvVar: (projectId: number, key: string, value: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/env`, {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    }),
  deleteEnvVar: (projectId: number, key: string) =>
    request<void>(`/projects/${projectId}/env/${encodeURIComponent(key)}`, { method: "DELETE" }),
};
