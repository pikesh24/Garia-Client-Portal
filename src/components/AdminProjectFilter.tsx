"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Project, User } from "@/lib/types";
import { BrutalistSelect } from "@/components/BrutalistSelect";

export interface ProjectFilterValue {
  clientId: string;
  projectId: string;
}

export function useAdminProjectFilter(): [ProjectFilterValue, (v: ProjectFilterValue) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId") ?? "";
  const projectId = searchParams.get("projectId") ?? "";

  function setValue(v: ProjectFilterValue) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (v.clientId) params.set("clientId", v.clientId);
    else params.delete("clientId");
    if (v.projectId) params.set("projectId", v.projectId);
    else params.delete("projectId");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return [{ clientId, projectId }, setValue];
}

export function AdminProjectFilter({
  value,
  onChange,
}: {
  value: ProjectFilterValue;
  onChange: (v: ProjectFilterValue) => void;
}) {
  const [clients, setClients] = useState<User[]>([]);
  const [modalProjects, setModalProjects] = useState<Project[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  
  // For the modal's internal state
  const [activeClientId, setActiveClientId] = useState(value.clientId);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiRequest<User[]>("/api/admin/users").then(setClients);
  }, []);

  // Sync activeClientId with value.clientId when modal opens
  useEffect(() => {
    if (modalOpen) {
      setActiveClientId(value.clientId);
      setSearch("");
    }
  }, [modalOpen, value.clientId]);

  // Fetch projects for the modal's active client
  useEffect(() => {
    if (!activeClientId) {
      setModalProjects([]);
      return;
    }
    apiRequest<Project[]>(`/api/admin/users/${activeClientId}/projects`).then(setModalProjects);
  }, [activeClientId]);

  const selectedClient = clients.find((c) => String(c.id) === value.clientId);
  // We need to fetch the selected project if it's not in modalProjects (e.g. on initial load)
  const [globalProject, setGlobalProject] = useState<Project | null>(null);

  useEffect(() => {
    if (value.clientId && value.projectId) {
      // Find it in modalProjects if available, otherwise fetch it
      const p = modalProjects.find(p => String(p.id) === value.projectId);
      if (p) setGlobalProject(p);
      else {
        apiRequest<Project>(`/api/admin/projects/${value.projectId}`).then(setGlobalProject).catch(() => setGlobalProject(null));
      }
    } else {
      setGlobalProject(null);
    }
  }, [value.clientId, value.projectId, modalProjects]);

  const filteredClients = clients.filter(c => 
    c.full_name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full text-left flex items-center justify-between border-4 border-border-strong bg-bg-panel-alt p-4 md:p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_var(--shadow-strong)] transition-all mb-8 group"
      >
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:flex w-12 h-12 bg-text-main text-bg-base items-center justify-center font-black text-2xl shadow-[4px_4px_0px_0px_var(--border-subtle)]">
            <span className="material-symbols-outlined">filter_list</span>
          </div>
          <div>
            <div className="font-label-caps text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">
              Current View
            </div>
            <div className="font-headline-lg text-lg md:text-2xl font-black uppercase text-text-main flex flex-wrap items-center gap-2">
              <span>{selectedClient ? selectedClient.full_name : "All Clients"}</span>
              {globalProject && (
                <>
                  <span className="text-text-muted">/</span>
                  <span className="text-brand-green">{globalProject.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-text-main group-hover:text-brand-green transition-colors font-bold uppercase tracking-widest text-[10px] md:text-xs shrink-0">
          <span className="hidden md:inline">Change View</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </div>
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-bg-base/80 backdrop-blur-sm">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setModalOpen(false)}></div>
          
          <div className="relative w-full max-w-5xl h-[85vh] bg-bg-panel border-4 border-border-strong shadow-[12px_12px_0px_0px_var(--shadow-strong)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b-4 border-border-strong bg-bg-panel-alt">
              <h2 className="font-headline-lg text-xl md:text-2xl font-black uppercase text-text-main">
                Filter Context
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="w-10 h-10 border-2 border-border-strong flex items-center justify-center hover:bg-border-strong hover:text-bg-base transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content Split */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-bg-base">
              
              {/* Left Column: Clients */}
              <div className="w-full md:w-1/2 flex flex-col border-b-4 md:border-b-0 md:border-r-4 border-border-strong">
                <div className="p-4 border-b-2 border-border-strong/20 bg-bg-panel-alt">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">search</span>
                    <input 
                      type="text" 
                      placeholder="Search clients..." 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-bg-base border-2 border-border-strong p-3 pl-10 font-data-mono text-sm focus:outline-none focus:border-text-main placeholder:text-text-muted/60"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {!search && (
                    <button
                      onClick={() => {
                        onChange({ clientId: "", projectId: "" });
                        setModalOpen(false);
                      }}
                      className={`w-full text-left p-4 border-2 flex items-center gap-3 transition-colors ${!activeClientId ? 'bg-text-main border-text-main text-bg-base shadow-[4px_4px_0px_0px_var(--border-subtle)]' : 'border-transparent hover:border-border-strong/30 hover:bg-border-strong/5 text-text-main'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${!activeClientId ? 'bg-bg-base text-text-main' : 'bg-border-strong/10 text-text-main'}`}>
                        <span className="material-symbols-outlined">language</span>
                      </div>
                      <span className="font-bold uppercase tracking-widest text-sm">All Clients</span>
                    </button>
                  )}
                  
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveClientId(String(c.id))}
                      className={`w-full text-left p-4 border-2 flex items-center justify-between transition-colors ${activeClientId === String(c.id) ? 'bg-text-main border-text-main text-bg-base shadow-[4px_4px_0px_0px_var(--border-subtle)]' : 'border-transparent hover:border-border-strong/30 hover:bg-border-strong/5 text-text-main'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 shrink-0 border-2 flex items-center justify-center font-black text-lg ${activeClientId === String(c.id) ? 'bg-brand-green border-bg-base text-on-brand-green' : 'bg-bg-panel-alt border-border-strong text-text-main'}`}>
                          {c.full_name ? c.full_name[0].toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold uppercase truncate">{c.full_name}</div>
                          <div className={`text-[10px] font-data-mono truncate ${activeClientId === String(c.id) ? 'text-bg-base/70' : 'text-text-muted'}`}>{c.email}</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined shrink-0 opacity-50">chevron_right</span>
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="p-8 text-center text-text-muted font-data-mono text-sm uppercase">No clients found</div>
                  )}
                </div>
              </div>

              {/* Right Column: Projects */}
              <div className="w-full md:w-1/2 flex flex-col bg-bg-panel-alt">
                {!activeClientId ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
                    <span className="material-symbols-outlined text-6xl mb-4 opacity-50">touch_app</span>
                    <p className="font-data-mono text-sm uppercase tracking-widest max-w-[200px]">Select a client to view their projects</p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 border-b-2 border-border-strong/20">
                      <button
                        onClick={() => {
                          onChange({ clientId: activeClientId, projectId: "" });
                          setModalOpen(false);
                        }}
                        className={`w-full text-left p-4 border-2 border-border-strong flex items-center justify-between transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--shadow-strong)] ${value.clientId === activeClientId && !value.projectId ? 'bg-brand-green text-on-brand-green' : 'bg-bg-base text-text-main'}`}
                      >
                        <span className="font-black uppercase tracking-widest">All Projects for Client</span>
                        <span className="material-symbols-outlined">check_circle</span>
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                      {modalProjects.length === 0 ? (
                        <div className="p-8 text-center text-text-muted font-data-mono text-sm uppercase border-2 border-dashed border-border-strong/30">
                          No projects yet
                        </div>
                      ) : (
                        modalProjects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              onChange({ clientId: activeClientId, projectId: String(p.id) });
                              setModalOpen(false);
                            }}
                            className={`w-full text-left p-5 border-4 border-border-strong transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] flex flex-col gap-2 ${value.projectId === String(p.id) ? 'bg-brand-green text-on-brand-green' : 'bg-bg-base text-text-main'}`}
                          >
                            <div className="flex items-start justify-between">
                              <h3 className="font-headline-lg font-black uppercase text-lg leading-tight">{p.name}</h3>
                              <div className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${p.status === 'active' ? (value.projectId === String(p.id) ? 'bg-on-brand-green text-brand-green' : 'bg-brand-green text-white') : 'bg-coral-red text-white'}`}>
                                {p.status}
                              </div>
                            </div>
                            <div className={`font-data-mono text-xs ${value.projectId === String(p.id) ? 'text-on-brand-green/70' : 'text-text-muted'}`}>
                              Select Project →
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
