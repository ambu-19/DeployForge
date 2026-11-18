export interface User {
  id: number;
  login: string;
  github: boolean;
}

export interface Project {
  id: number;
  name: string;
  slug: string;
  repo: string;
  branch: string;
  root_dir?: string;
  port: number;
  health_path: string;
  framework: string;
  custom_dockerfile?: string | null;
  build_cmd?: string | null;
  start_cmd?: string | null;
  url: string;
  live_deployment?: number | null;
  latest_status: string;
  is_running: boolean;
  created_at?: string | null;
}

export interface Deployment {
  id: number;
  status: "queued" | "cloning" | "detecting" | "building" | "deploying" | "live" | "failed" | "superseded";
  kind: "push" | "manual" | "rollback" | "auto-rollback";
  commit: string;
  message: string;
  created_at: string;
  finished_at?: string | null;
  can_rollback: boolean;
}

export interface DetectedApp {
  name: string;
  path: string;
  framework: string;
  language: string;
  package_manager: string;
  recommended_port: number;
  health_path: string;
  build_command: string;
  start_command: string;
  dockerfile: string;
  dockerignore?: string;
  docker_compose?: string;
  details: string;
  env_vars?: string[];
}

export interface DetectionResult {
  kind: string;
  framework: string;
  language: string;
  package_manager: string;
  build_command: string;
  start_command: string;
  recommended_port: number;
  health_path: string;
  dockerfile: string;
  dockerignore: string;
  docker_compose: string;
  details: string;
  root_dir?: string;
  monorepo?: boolean;
  apps?: DetectedApp[];
  env_vars?: string[];
}

export interface FrameworkTemplate {
  id: string;
  name: string;
  language: string;
  port: number;
}

export interface OverviewStats {
  total_projects: number;
  running_apps: number;
  successful_deployments: number;
  failed_deployments: number;
  total_deployments: number;
  success_rate: number;
  recent_activity: {
    id: number;
    project_name: string;
    status: string;
    kind: string;
    commit: string;
    message: string;
    created_at: string;
  }[];
  domain: string;
  public_url: string;
}

export interface MonitoringContainer {
  project_id: number;
  project_name: string;
  container_id: string;
  name: string;
  status: string;
  cpu: number;
  mem_mb: number;
  port: number;
  health_path: string;
  url: string;
}

export interface MonitoringData {
  prometheus_healthy: boolean;
  grafana_url: string;
  total_cpu: number;
  total_mem_mb: number;
  containers: MonitoringContainer[];
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  description: string;
  default_branch: string;
  private: boolean;
  updated_at?: string;
  stars: number;
  html_url: string;
}

export interface EnvVariable {
  key: string;
  value: string;
}

export interface AuthStatus {
  github_configured: boolean;
  dev_login_enabled: boolean;
  public_url: string;
  domain: string;
  app_port: string;
}
