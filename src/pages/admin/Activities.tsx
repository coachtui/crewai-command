import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Users, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityLog {
  id: string;
  type: 'assignment' | 'reassignment' | 'removal';
  worker_name: string;
  task_name: string;
  from_task_name?: string;
  date: string;
  created_at: string;
  acknowledged: boolean;
}

export function Activities() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'acknowledged'>('pending');

  useEffect(() => {
    fetchActivities();
  }, []);

  // Real-time updates
  useRealtimeSubscription('assignments', () => fetchActivities());

  const fetchActivities = async () => {
    try {
      // Get recent assignment changes (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          task:tasks(name),
          worker:workers(name)
        `)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to activity logs
      const logs: ActivityLog[] = (data || []).map(assignment => ({
        id: assignment.id,
        type: assignment.status === 'reassigned' ? 'reassignment' : 
              assignment.status === 'assigned' ? 'assignment' : 'removal',
        worker_name: assignment.worker?.name || 'Unknown Worker',
        task_name: assignment.task?.name || 'Unknown Task',
        date: assignment.assigned_date,
        created_at: assignment.created_at,
        acknowledged: false, // We'll track this separately in production
      }));

      setActivities(logs);
    } catch (error) {
      toast.error('Failed to load activities');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (activityId: string) => {
    // In production, this would update an 'acknowledged' field
    // For now, we'll just show a toast
    toast.success('Activity acknowledged');
    
    // Update local state
    setActivities(prev => prev.map(a => 
      a.id === activityId ? { ...a, acknowledged: true } : a
    ));
  };

  const handleAcknowledgeAll = () => {
    toast.success('All activities acknowledged');
    setActivities(prev => prev.map(a => ({ ...a, acknowledged: true })));
  };

  const filteredActivities = activities.filter(a => {
    if (filter === 'pending') return !a.acknowledged;
    if (filter === 'acknowledged') return a.acknowledged;
    return true;
  });

  const pendingCount = activities.filter(a => !a.acknowledged).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Activity Dashboard</h1>
          <p className="text-text-secondary">Review and acknowledge crew movements</p>
        </div>

        {pendingCount > 0 && (
          <Button onClick={handleAcknowledgeAll}>
            <CheckCircle size={20} className="mr-2" />
            Acknowledge All ({pendingCount})
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-primary text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
          }`}
        >
          Pending
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('acknowledged')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'acknowledged'
              ? 'bg-primary text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
          }`}
        >
          Acknowledged
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
          }`}
        >
          All Activity
        </button>
      </div>

      {/* Activities List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading activities...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-text-secondary">
            {filter === 'pending' 
              ? 'No pending activities to review'
              : filter === 'acknowledged'
              ? 'No acknowledged activities yet'
              : 'No recent activity in the last 7 days'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <Card
              key={activity.id}
              className={`p-4 ${
                activity.acknowledged 
                  ? 'opacity-60' 
                  : 'border-l-4 border-l-primary'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${
                    activity.acknowledged 
                      ? 'bg-success/20' 
                      : 'bg-primary/20'
                  }`}>
                    {activity.acknowledged ? (
                      <CheckCircle size={24} className="text-success" />
                    ) : (
                      <Users size={24} className="text-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Activity Description */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{activity.worker_name}</span>
                      {activity.type === 'assignment' && (
                        <>
                          <span className="text-text-secondary">assigned to</span>
                          <span className="font-semibold text-primary">
                            {activity.task_name}
                          </span>
                        </>
                      )}
                      {activity.type === 'reassignment' && activity.from_task_name && (
                        <>
                          <span className="text-text-secondary">moved from</span>
                          <span className="font-semibold">{activity.from_task_name}</span>
                          <ArrowRight size={16} className="text-text-secondary" />
                          <span className="font-semibold text-primary">
                            {activity.task_name}
                          </span>
                        </>
                      )}
                      {activity.type === 'removal' && (
                        <>
                          <span className="text-text-secondary">removed from</span>
                          <span className="font-semibold">{activity.task_name}</span>
                        </>
                      )}
                    </div>

                    {/* Date & Time Info */}
                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <span>•</span>
                      <span>For: {format(new Date(activity.date), 'MMM d, yyyy')}</span>
                    </div>

                    {/* Acknowledged Status */}
                    {activity.acknowledged && (
                      <Badge variant="success" className="mt-2">
                        Acknowledged
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {!activity.acknowledged && (
                  <Button
                    size="sm"
                    onClick={() => handleAcknowledge(activity.id)}
                    variant="secondary"
                  >
                    <CheckCircle size={16} className="mr-1" />
                    Acknowledge
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-text-secondary mb-1">Total Activity (7 days)</div>
          <div className="text-3xl font-bold">{activities.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-text-secondary mb-1">Pending Review</div>
          <div className="text-3xl font-bold text-warning">{pendingCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-text-secondary mb-1">Acknowledged</div>
          <div className="text-3xl font-bold text-success">
            {activities.filter(a => a.acknowledged).length}
          </div>
        </Card>
      </div>
    </div>
  );
}
