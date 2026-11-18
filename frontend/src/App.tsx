import React, { useEffect, useState } from "react";
import { api, getToken, onAuthChange } from "./api";
import { Navbar } from "./components/Navbar";
import { NavTab, Sidebar } from "./components/Sidebar";
import { MonitoringData, OverviewStats, Project, User } from "./types";
import { DeploymentsView } from "./views/DeploymentsView";
import { DockerfileStudioView } from "./views/DockerfileStudioView";
import { DomainsView } from "./views/DomainsView";
import { GitHubReposView } from "./views/GitHubReposView";
import { GlobalEnvVarsView } from "./views/GlobalEnvVarsView";
import { GlobalLogsView } from "./views/GlobalLogsView";
import { LoginView } from "./views/LoginView";
import { MonitoringView } from "./views/MonitoringView";
import { NewProjectWizard } from "./views/NewProjectWizard";
import { OverviewView } from "./views/OverviewView";
import { ProjectDetailView } from "./views/ProjectDetailView";
import { ProjectsView } from "./views/ProjectsView";
import { SettingsView } from "./views/SettingsView";

export default function App() {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [user, setUser] = useState<User | null>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialRepo, setWizardInitialRepo] = useState("");

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthChange((isAuthed) => {
      setAuthed(isAuthed);
      if (!isAuthed) {
        setUser(null);
        setProjects([]);
      }
    });
    return unsub;
  }, []);

  // Fetch initial profile & projects when authenticated
  const refreshProjects = async () => {
    if (!authed) return;
    try {
      const p = await api.getProjects();
      setProjects(p);
      const st = await api.getOverview();
      setOverviewStats(st);
      const mon = await api.getMonitoring();
      setMonitoringData(mon);
    } catch {
      // handled by api layer
    }
  };

  useEffect(() => {
    if (!authed) return;
    api
      .getMe()
      .then(setUser)
      .catch(() => {});

    refreshProjects();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshProjects();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [authed]);

  const handleLogout = () => {
    api.logout();
    setAuthed(false);
  };

  const handleLaunchWizard = (repo = "") => {
    setWizardInitialRepo(repo);
    setWizardOpen(true);
  };

  const handleWizardDone = (newProjectId: number) => {
    setWizardOpen(false);
    setSelectedProjectId(newProjectId);
    setActiveTab("projects");
    refreshProjects();
  };

  // If not authenticated, render Login Page
  if (!authed) {
    return <LoginView onLoginSuccess={() => setAuthed(true)} />;
  }

  // Get active section title for top navbar
  const getSectionTitle = () => {
    if (wizardOpen) return "New Application Setup";
    if (activeTab === "projects" && selectedProjectId) {
      const p = projects.find((x) => x.id === selectedProjectId);
      return p ? `Service / ${p.name}` : "Project Details";
    }
    const map: Record<NavTab, string> = {
      overview: "Platform Overview",
      projects: "Applications",
      deployments: "Deployments",
      repos: "GitHub Repositories",
      generator: "Dockerfile Studio",
      history: "Build History",
      logs: "Log Streams",
      env: "Environment Variables",
      domains: "Domains & Routing",
      monitoring: "Monitoring & Telemetry",
      settings: "Platform Settings",
    };
    return map[activeTab] || "Dashboard";
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex text-slate-100 selection:bg-indigo-500/30">
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setWizardOpen(false);
          if (tab !== "projects") {
            setSelectedProjectId(null);
          }
        }}
        user={user}
        onLogout={handleLogout}
        projectCount={projects.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* Top Navbar */}
        <Navbar
          title={getSectionTitle()}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(id) => {
            setSelectedProjectId(id);
            if (id !== null) {
              setActiveTab("projects");
              setWizardOpen(false);
            }
          }}
          onNewProject={() => handleLaunchWizard()}
        />

        {/* View Router */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {wizardOpen ? (
            <NewProjectWizard
              onCancel={() => setWizardOpen(false)}
              onCreated={handleWizardDone}
              initialRepo={wizardInitialRepo}
            />
          ) : activeTab === "projects" && selectedProjectId ? (
            <ProjectDetailView
              projectId={selectedProjectId}
              onBack={() => setSelectedProjectId(null)}
              onDeleted={() => {
                setSelectedProjectId(null);
                refreshProjects();
              }}
            />
          ) : (
            <>
              {activeTab === "overview" && (
                <OverviewView
                  stats={overviewStats}
                  projects={projects}
                  monitoring={monitoringData}
                  onNewProject={() => handleLaunchWizard()}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                    setActiveTab("projects");
                  }}
                  onDeployProject={async (id) => {
                    await api.deployProject(id);
                    setSelectedProjectId(id);
                    setActiveTab("projects");
                    refreshProjects();
                  }}
                />
              )}

              {activeTab === "projects" && (
                <ProjectsView
                  projects={projects}
                  onSelectProject={(id) => setSelectedProjectId(id)}
                  onNewProject={() => handleLaunchWizard()}
                  onRefresh={refreshProjects}
                />
              )}

              {(activeTab === "deployments" || activeTab === "history") && (
                <DeploymentsView
                  projects={projects}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                    setActiveTab("projects");
                  }}
                />
              )}

              {activeTab === "repos" && (
                <GitHubReposView
                  user={user}
                  onDeployRepo={(repo) => handleLaunchWizard(repo)}
                />
              )}

              {activeTab === "generator" && (
                <DockerfileStudioView
                  onDeployConfiguration={(cfg) => {
                    handleLaunchWizard();
                  }}
                />
              )}

              {activeTab === "logs" && <GlobalLogsView projects={projects} />}

              {activeTab === "env" && <GlobalEnvVarsView projects={projects} />}

              {activeTab === "domains" && <DomainsView projects={projects} />}

              {activeTab === "monitoring" && <MonitoringView />}

              {activeTab === "settings" && (
                <SettingsView user={user} onLogout={handleLogout} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
