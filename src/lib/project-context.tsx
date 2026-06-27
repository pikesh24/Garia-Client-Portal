"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { Project, ProjectListResponse } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const CURRENT_PROJECT_KEY = "garia_current_project_id";

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProjectId: (id: number) => void;
  loading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    if (user?.role !== "client") {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<ProjectListResponse>("/api/projects");
      setProjects(data.projects);

      const storedId = Number(localStorage.getItem(CURRENT_PROJECT_KEY));
      const stored = data.projects.find((p) => p.id === storedId);
      const fallback = data.projects.find((p) => p.id === data.default_project_id) ?? null;
      setCurrentProject(stored ?? fallback);
    } catch {
      setProjects([]);
      setCurrentProject(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const setCurrentProjectId = useCallback(
    (id: number) => {
      const next = projects.find((p) => p.id === id) ?? null;
      setCurrentProject(next);
      if (next) {
        localStorage.setItem(CURRENT_PROJECT_KEY, String(next.id));
      }
    },
    [projects]
  );

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProjectId, loading, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
