import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useJobSite } from '../../contexts';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { Upload, Trash2, Download, Edit2, FileText, Image, File, Check, X } from 'lucide-react';

interface SharedFile {
  id: string;
  organization_id: string;
  job_site_id: string | null;
  name: string;
  storage_path: string;
  url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  uploader?: { name: string } | null;
}

export function SharedFiles() {
  const { user } = useAuth();
  const { currentJobSite, availableJobSites } = useJobSite();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectSites = availableJobSites.filter(s => !s.is_system_site);
  const activeSiteId = selectedSiteId ?? currentJobSite?.id ?? null;
  const activeSite = projectSites.find(s => s.id === activeSiteId) ?? null;

  // Workers (viewer/worker role) get read-only; everyone else can manage
  const canManage = ['admin', 'superintendent', 'engineer', 'foreman'].includes(
    user?.base_role || user?.role || ''
  );

  // When the global job site context changes, reset local selection so it tracks automatically
  useEffect(() => {
    setSelectedSiteId(null);
  }, [currentJobSite?.id]);

  useEffect(() => {
    if (user?.org_id) {
      fetchFiles();
    }
  }, [user?.org_id, activeSiteId]);

  const fetchFiles = async () => {
    if (!user?.org_id || !activeSiteId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shared_files')
        .select('*, uploader:users!uploaded_by(name)')
        .eq('organization_id', user.org_id)
        .eq('job_site_id', activeSiteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      toast.error('Failed to load files');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user?.org_id || !activeSiteId) return;
    setUploading(true);
    const filesToUpload = Array.from(e.target.files);
    let successCount = 0;

    for (const file of filesToUpload) {
      try {
        const fileExt = file.name.split('.').pop() || 'bin';
        const storageName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storagePath = `shared/${user.org_id}/${storageName}`;

        const { error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('task-files')
          .getPublicUrl(storagePath);

        const { error: insertError } = await supabase
          .from('shared_files')
          .insert({
            organization_id: user.org_id,
            job_site_id: activeSiteId,
            name: file.name,
            storage_path: storagePath,
            url: publicUrl,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (insertError) throw insertError;
        successCount++;
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
        console.error(error);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
      fetchFiles();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRename = async (fileId: string) => {
    if (!renameValue.trim()) return;
    try {
      const { error } = await supabase
        .from('shared_files')
        .update({ name: renameValue.trim(), updated_at: new Date().toISOString() })
        .eq('id', fileId);

      if (error) throw error;
      toast.success('File renamed');
      setRenamingId(null);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: renameValue.trim() } : f));
    } catch (error) {
      toast.error('Failed to rename file');
      console.error(error);
    }
  };

  const handleDelete = async (file: SharedFile) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('task-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('shared_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast.success('File deleted');
      setDeleteConfirmId(null);
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error) {
      toast.error('Failed to delete file');
      console.error(error);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string | null, storagePath: string) => {
    const isImage = fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(storagePath);
    const isPdf = fileType === 'application/pdf' || storagePath.endsWith('.pdf');
    if (isImage) return <Image size={20} className="text-blue-500" />;
    if (isPdf) return <FileText size={20} className="text-red-500" />;
    return <File size={20} className="text-text-secondary" />;
  };

  const deleteFile = files.find(f => f.id === deleteConfirmId);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-1">Shared Files</h1>
            {projectSites.length > 1 ? (
              <select
                value={activeSiteId ?? ''}
                onChange={e => setSelectedSiteId(e.target.value || null)}
                className="mt-1 text-sm border border-border rounded-md px-2 py-1 bg-bg-primary text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a project...</option>
                {projectSites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-[14px] text-text-secondary">
                {activeSite ? `Files for ${activeSite.name}` : 'Select a project to view shared files'}
              </p>
            )}
          </div>
          {canManage && activeSiteId && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.dwg,.dxf"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={16} className="mr-2" />
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* File List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading files...</p>
        </div>
      ) : !activeSiteId ? (
        <div className="text-center py-16 bg-bg-secondary border border-gray-100 rounded-xl shadow-sm-soft">
          <File size={40} className="mx-auto text-text-secondary mb-3 opacity-40" />
          <p className="text-text-secondary font-medium">No project selected</p>
          <p className="text-sm text-text-secondary mt-1">Select a project to view its shared files</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 bg-bg-secondary border border-gray-100 rounded-xl shadow-sm-soft">
          <File size={40} className="mx-auto text-text-secondary mb-3 opacity-40" />
          <p className="text-text-secondary font-medium">No files yet</p>
          {canManage && (
            <p className="text-sm text-text-secondary mt-1">
              Click "Upload Files" to get started
            </p>
          )}
        </div>
      ) : (
        <div className="bg-bg-secondary border border-gray-100 rounded-xl overflow-hidden shadow-sm-soft">
          <div className="divide-y divide-border">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-bg-hover transition-colors"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-8 flex items-center justify-center">
                  {getFileIcon(file.file_type, file.storage_path)}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  {renamingId === file.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(file.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="text-sm font-medium border border-primary rounded px-2 py-0.5 bg-bg-primary focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
                      />
                      <button
                        onClick={() => handleRename(file.id)}
                        className="text-success hover:opacity-70"
                        title="Save"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="text-text-secondary hover:opacity-70"
                        title="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-text-primary hover:text-primary hover:underline truncate block"
                    >
                      {file.name}
                    </a>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    {file.file_size != null && (
                      <span className="text-xs text-text-secondary">{formatFileSize(file.file_size)}</span>
                    )}
                    {file.uploader?.name && (
                      <span className="text-xs text-text-secondary">by {file.uploader.name}</span>
                    )}
                    <span className="text-xs text-text-secondary">
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => window.open(file.url, '_blank')}
                    className="p-1.5 hover:bg-bg-subtle rounded transition-colors"
                    title="Open / Download"
                  >
                    <Download size={16} className="text-text-secondary" />
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => {
                          setRenamingId(file.id);
                          setRenameValue(file.name);
                        }}
                        className="p-1.5 hover:bg-bg-subtle rounded transition-colors"
                        title="Rename"
                      >
                        <Edit2 size={16} className="text-text-secondary" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(file.id)}
                        className="p-1.5 hover:bg-bg-subtle rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} className="text-error" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteFile && (
        <Modal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete File"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-text-secondary">
              Are you sure you want to delete{' '}
              <span className="font-medium text-text-primary">{deleteFile.name}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteFile)}>
                Delete
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
