import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Check, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Crew, Worker } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth, useJobSite } from '../../contexts';
import { toast } from 'sonner';

const CREW_COLORS = [
  '#6366f1', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899',
];

interface CrewManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function CrewManagementPanel({ isOpen, onClose, onUpdate }: CrewManagementPanelProps) {
  const { user } = useAuth();
  const { currentJobSite } = useJobSite();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewColor, setNewCrewColor] = useState(CREW_COLORS[0]);
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const [editingCrewName, setEditingCrewName] = useState('');
  // Multi-select worker picker state
  const [addingWorkerToCrewId, setAddingWorkerToCrewId] = useState<string | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && currentJobSite) {
      fetchData();
    }
  }, [isOpen, currentJobSite?.id]);

  const fetchData = async () => {
    if (!currentJobSite || !user?.org_id) return;
    setLoading(true);
    try {
      const [crewsRes, workersRes] = await Promise.all([
        supabase
          .from('crews')
          .select('*')
          .eq('job_site_id', currentJobSite.id)
          .order('name'),
        supabase
          .from('workers')
          .select('*')
          .eq('job_site_id', currentJobSite.id)
          .eq('status', 'active')
          .order('name'),
      ]);
      if (crewsRes.error) throw crewsRes.error;
      if (workersRes.error) throw workersRes.error;
      setCrews(crewsRes.data || []);
      setWorkers(workersRes.data || []);
    } catch (err) {
      toast.error('Failed to load crews');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCrew = async () => {
    if (!newCrewName.trim() || !currentJobSite || !user?.org_id) return;
    try {
      const { error } = await supabase.from('crews').insert({
        job_site_id: currentJobSite.id,
        organization_id: user.org_id,
        name: newCrewName.trim(),
        color: newCrewColor,
        created_by: user.id,
      });
      if (error) throw error;
      setNewCrewName('');
      toast.success('Crew created');
      fetchData();
      onUpdate();
    } catch (err) {
      toast.error('Failed to create crew');
      console.error(err);
    }
  };

  const handleRenameCrew = async (crewId: string) => {
    if (!editingCrewName.trim()) return;
    try {
      const { error } = await supabase
        .from('crews')
        .update({ name: editingCrewName.trim(), updated_at: new Date().toISOString() })
        .eq('id', crewId);
      if (error) throw error;
      setEditingCrewId(null);
      toast.success('Crew renamed');
      fetchData();
      onUpdate();
    } catch (err) {
      toast.error('Failed to rename crew');
      console.error(err);
    }
  };

  const handleDeleteCrew = async (crewId: string, crewName: string) => {
    if (!confirm(`Delete "${crewName}"? Workers will become unassigned from this crew.`)) return;
    try {
      const { error } = await supabase.from('crews').delete().eq('id', crewId);
      if (error) throw error;
      toast.success('Crew deleted');
      fetchData();
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete crew');
      console.error(err);
    }
  };

  // Bulk-assign all selected workers to a crew in one shot
  const handleConfirmAddWorkers = async (crewId: string) => {
    if (selectedWorkerIds.size === 0) return;
    const ids = Array.from(selectedWorkerIds);
    try {
      const { error } = await supabase
        .from('workers')
        .update({ crew_id: crewId })
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} worker${ids.length !== 1 ? 's' : ''} added to crew`);
      closePicker();
      fetchData();
      onUpdate();
    } catch (err) {
      toast.error('Failed to assign workers');
      console.error(err);
    }
  };

  const handleRemoveWorkerFromCrew = async (workerId: string) => {
    try {
      const { error } = await supabase
        .from('workers')
        .update({ crew_id: null })
        .eq('id', workerId);
      if (error) throw error;
      fetchData();
      onUpdate();
    } catch (err) {
      toast.error('Failed to remove worker from crew');
      console.error(err);
    }
  };

  const openPicker = (crewId: string) => {
    setAddingWorkerToCrewId(crewId);
    setSelectedWorkerIds(new Set());
  };

  const closePicker = () => {
    setAddingWorkerToCrewId(null);
    setSelectedWorkerIds(new Set());
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const getCrewWorkers = (crewId: string) => workers.filter(w => w.crew_id === crewId);
  // "available" = not already in THIS crew (can move from another)
  const getAvailableWorkers = (crewId: string) => workers.filter(w => w.crew_id !== crewId);
  const unassignedCount = workers.filter(w => !w.crew_id).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Crews" size="lg">
      {loading ? (
        <div className="text-center py-8">
          <p className="text-text-secondary">Loading...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Create New Crew */}
          <div className="p-4 bg-bg-primary border border-border rounded-xl">
            <h3 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide mb-3">
              New Crew
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="e.g. Concrete Crew"
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCrew()}
                className="flex-1 h-10 px-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              <Button onClick={handleCreateCrew} disabled={!newCrewName.trim()} className="h-10 px-4">
                <Plus size={16} className="mr-1" />
                Create
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {CREW_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewCrewColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    newCrewColor === color ? 'border-text-primary scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Existing Crews */}
          {crews.length === 0 ? (
            <p className="text-center text-text-secondary py-4 text-[14px]">
              No crews yet — create one above.
            </p>
          ) : (
            <div className="space-y-3">
              {crews.map(crew => {
                const crewWorkers = getCrewWorkers(crew.id);
                const available = getAvailableWorkers(crew.id);
                const isEditing = editingCrewId === crew.id;
                const isAddingWorker = addingWorkerToCrewId === crew.id;
                const allSelected = available.length > 0 && available.every(w => selectedWorkerIds.has(w.id));

                return (
                  <div key={crew.id} className="border border-border rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-bg-secondary">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: crew.color || '#6366f1' }}
                        />
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingCrewName}
                              onChange={(e) => setEditingCrewName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameCrew(crew.id);
                                if (e.key === 'Escape') setEditingCrewId(null);
                              }}
                              autoFocus
                              className="h-8 px-2 bg-bg-primary border border-primary rounded-lg text-[14px] text-text-primary focus:outline-none"
                            />
                            <button
                              onClick={() => handleRenameCrew(crew.id)}
                              className="p-1.5 hover:bg-bg-hover rounded-lg"
                            >
                              <Check size={14} className="text-success" />
                            </button>
                            <button
                              onClick={() => setEditingCrewId(null)}
                              className="p-1.5 hover:bg-bg-hover rounded-lg"
                            >
                              <X size={14} className="text-text-secondary" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[14px] font-semibold text-text-primary truncate">
                            {crew.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[12px] text-text-secondary flex-shrink-0">
                          <Users size={11} />
                          {crewWorkers.length}
                        </span>
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingCrewId(crew.id);
                              setEditingCrewName(crew.name);
                            }}
                            className="p-1.5 hover:bg-bg-hover rounded-lg transition-colors"
                            title="Rename"
                          >
                            <Edit2 size={14} className="text-text-secondary" />
                          </button>
                          <button
                            onClick={() => handleDeleteCrew(crew.id, crew.name)}
                            className="p-1.5 hover:bg-bg-hover rounded-lg transition-colors"
                            title="Delete crew"
                          >
                            <Trash2 size={14} className="text-error" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Workers in crew */}
                    <div className="px-4 py-3 space-y-2">
                      {crewWorkers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {crewWorkers.map(worker => (
                            <div
                              key={worker.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-secondary rounded-lg border border-border text-[13px]"
                            >
                              <span>{worker.name}</span>
                              <span className="text-[11px] text-text-secondary capitalize">
                                ({worker.role})
                              </span>
                              <button
                                onClick={() => handleRemoveWorkerFromCrew(worker.id)}
                                className="ml-0.5 hover:text-error transition-colors"
                                title="Remove from crew"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {crewWorkers.length === 0 && !isAddingWorker && (
                        <p className="text-[13px] text-text-secondary italic">No workers in this crew</p>
                      )}

                      {/* Multi-select worker picker */}
                      {isAddingWorker ? (
                        <div className="mt-1 border border-primary/40 rounded-lg overflow-hidden">
                          {/* Picker header: select-all + close */}
                          <div className="flex items-center justify-between px-3 py-2 bg-bg-primary border-b border-border">
                            <button
                              onClick={() => {
                                if (allSelected) {
                                  setSelectedWorkerIds(new Set());
                                } else {
                                  setSelectedWorkerIds(new Set(available.map(w => w.id)));
                                }
                              }}
                              className="flex items-center gap-2 text-[13px] font-medium text-text-primary hover:text-primary transition-colors"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                allSelected
                                  ? 'bg-primary border-primary'
                                  : selectedWorkerIds.size > 0
                                  ? 'bg-primary/20 border-primary'
                                  : 'border-gray-300 bg-bg-secondary'
                              }`}>
                                {allSelected && <Check size={10} className="text-white" />}
                                {!allSelected && selectedWorkerIds.size > 0 && (
                                  <span className="w-2 h-0.5 bg-primary rounded" />
                                )}
                              </div>
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                            <button onClick={closePicker} className="p-1 hover:text-text-primary text-text-secondary">
                              <X size={14} />
                            </button>
                          </div>

                          {/* Worker list */}
                          {available.length === 0 ? (
                            <p className="px-3 py-3 text-[13px] text-text-secondary italic">
                              No other workers available
                            </p>
                          ) : (
                            <div className="max-h-52 overflow-y-auto">
                              {available.map(worker => {
                                const checked = selectedWorkerIds.has(worker.id);
                                return (
                                  <button
                                    key={worker.id}
                                    onClick={() => toggleWorker(worker.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                      checked ? 'bg-primary/5' : 'hover:bg-bg-hover'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                      checked ? 'bg-primary border-primary' : 'border-gray-300 bg-bg-secondary'
                                    }`}>
                                      {checked && <Check size={10} className="text-white" />}
                                    </div>
                                    <span className="text-[13px] flex-1">{worker.name}</span>
                                    <span className="text-[11px] text-text-secondary capitalize">{worker.role}</span>
                                    {worker.crew_id && (
                                      <span className="text-[10px] text-warning">moves crew</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Confirm footer */}
                          {available.length > 0 && (
                            <div className="px-3 py-2 bg-bg-primary border-t border-border flex items-center justify-between gap-2">
                              <span className="text-[12px] text-text-secondary">
                                {selectedWorkerIds.size > 0
                                  ? `${selectedWorkerIds.size} selected`
                                  : 'Select workers above'}
                              </span>
                              <Button
                                size="sm"
                                onClick={() => handleConfirmAddWorkers(crew.id)}
                                disabled={selectedWorkerIds.size === 0}
                                className="h-8 px-3"
                              >
                                <Check size={13} className="mr-1" />
                                Add {selectedWorkerIds.size > 0 ? selectedWorkerIds.size : ''} to crew
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => openPicker(crew.id)}
                          className="flex items-center gap-1.5 text-[13px] text-primary hover:opacity-80 transition-opacity mt-1"
                        >
                          <Plus size={14} />
                          Add workers
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Unassigned count footer */}
          {unassignedCount > 0 && (
            <p className="text-center text-[13px] text-text-secondary">
              {unassignedCount} worker{unassignedCount !== 1 ? 's' : ''} not in any crew
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
