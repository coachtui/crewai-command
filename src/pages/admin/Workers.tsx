import { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { Button } from '../../components/ui/Button';
import { WorkerCard } from '../../components/workers/WorkerCard';
import { WorkerForm } from '../../components/workers/WorkerForm';
import { Modal } from '../../components/ui/Modal';
import type { Worker } from '../../types';
import { toast } from 'sonner';

export function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  // Enable real-time subscriptions for workers
  useRealtimeSubscription('workers', useCallback(() => fetchWorkers(), []));

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('name');

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      toast.error('Failed to load workers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorker = async (workerData: Partial<Worker>) => {
    try {
      if (editingWorker) {
        // Update existing worker
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', editingWorker.id);

        if (error) throw error;
        toast.success('Worker updated successfully');
      } else {
        // Create new worker
        const { error } = await supabase
          .from('workers')
          .insert([workerData]);

        if (error) throw error;
        toast.success('Worker created successfully');
      }

      fetchWorkers();
      setIsModalOpen(false);
      setEditingWorker(null);
    } catch (error) {
      toast.error('Failed to save worker');
      console.error(error);
    }
  };

  const handleEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    setIsModalOpen(true);
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!confirm('Are you sure you want to delete this worker?')) return;

    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', workerId);

      if (error) throw error;
      toast.success('Worker deleted successfully');
      fetchWorkers();
    } catch (error) {
      toast.error('Failed to delete worker');
      console.error(error);
    }
  };

  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || worker.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Workers</h1>
        <p className="text-text-secondary text-sm md:text-base">Manage your construction crew</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-6">
        <div className="relative sm:flex-1 sm:min-w-[300px] w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none z-10" size={20} />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-48 h-11 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Roles</option>
          <option value="operator">Operators</option>
          <option value="laborer">Laborers</option>
        </select>

        <Button
          onClick={() => {
            setEditingWorker(null);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto h-11 whitespace-nowrap"
        >
          <Plus size={20} className="mr-2" />
          Add Worker
        </Button>
      </div>

      {/* Workers Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading workers...</p>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">No workers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredWorkers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onEdit={handleEditWorker}
              onDelete={handleDeleteWorker}
            />
          ))}
        </div>
      )}

      {/* Worker Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWorker(null);
        }}
        title={editingWorker ? 'Edit Worker' : 'Add New Worker'}
      >
        <WorkerForm
          worker={editingWorker}
          onSave={handleSaveWorker}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingWorker(null);
          }}
        />
      </Modal>
    </div>
  );
}
