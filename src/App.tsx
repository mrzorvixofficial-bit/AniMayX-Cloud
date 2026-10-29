import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api.ts';
import {
  StoredFile,
  FolderItem,
  StorageStats,
  FileCategory,
  SortOption,
} from './types.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Navbar } from './components/Navbar.tsx';
import { DashboardOverview } from './components/DashboardOverview.tsx';
import { StorageStatsBar } from './components/StorageStatsBar.tsx';
import { FileList } from './components/FileList.tsx';
import { FileUploader } from './components/FileUploader.tsx';
import { FileDetailModal } from './components/FileDetailModal.tsx';
import { DirectTesterModal } from './components/DirectTesterModal.tsx';
import { DeploymentGuideModal } from './components/DeploymentGuideModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal.tsx';
import { RenameModal } from './components/RenameModal.tsx';
import { CreateFolderModal } from './components/CreateFolderModal.tsx';
import { RenameFolderModal } from './components/RenameFolderModal.tsx';
import { ConfirmDeleteFolderModal } from './components/ConfirmDeleteFolderModal.tsx';
import { LoginView } from './components/LoginView.tsx';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    api.isAuthenticated()
  );

  // Views & Navigation
  const [activeView, setActiveView] = useState<'overview' | 'files'>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Data states
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Filter & Search states
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [category, setCategory] = useState<FileCategory>('all');
  const [sort, setSort] = useState<SortOption>('date_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Debounce search input by 300ms to eliminate spammy duplicate network requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string>('');
  const [isTesterOpen, setIsTesterOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Folder modals state
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState<boolean>(false);

  // Selected file for inspection / actions
  const [inspectedFile, setInspectedFile] = useState<StoredFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<StoredFile | null>(null);
  const [fileToRename, setFileToRename] = useState<StoredFile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchFiles = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await api.getFiles({
        search: debouncedSearch,
        category,
        sort,
      });
      setFiles(data);
    } catch (err: unknown) {
      console.error('Failed to load files:', err);
      if (err instanceof Error && err.message.toLowerCase().includes('unauthorized')) {
        api.logout();
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, debouncedSearch, category, sort]);

  const fetchFolders = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const folderList = await api.getFolders();
      setFolders(folderList);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, [isAuthenticated]);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.getStorageStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [isAuthenticated]);

  // Fetch files and folders when debouncedSearch, category, or sort changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
      fetchFolders();
    }
  }, [isAuthenticated, fetchFiles, fetchFolders]);

  // Fetch stats on auth state change (login/mount)
  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated, fetchStats]);

  const handleRefresh = () => {
    fetchFiles();
    fetchFolders();
    fetchStats();
    showToast('Storage & files refreshed');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    showToast('Admin logged in successfully');
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setFiles([]);
    setFolders([]);
    setStats(null);
  };

  const handleUploadSuccess = (uploadedFile: StoredFile) => {
    showToast(`Uploaded ${uploadedFile.original_name}`);
    fetchFiles();
    fetchFolders();
    fetchStats();
  };

  const handleOpenUpload = (targetFolder?: string) => {
    setUploadTargetFolder(targetFolder !== undefined ? targetFolder : currentFolder);
    setIsUploadOpen(true);
  };

  // Folder Actions
  const handleCreateFolder = async (folderName: string) => {
    const res = await api.createFolder(folderName, currentFolder);
    showToast(`Created folder "${res.folder.name}"`);
    fetchFolders();
  };

  const handleRenameFolder = async (folder: FolderItem, newName: string) => {
    const res = await api.renameFolder(folder.id, newName);
    showToast(`Renamed folder to "${res.folder.name}"`);
    if (currentFolder === folder.path) {
      setCurrentFolder(res.folder.path);
    }
    fetchFolders();
    fetchFiles();
  };

  const handleDeleteFolderConfirm = async (folder: FolderItem, deleteFiles: boolean) => {
    setIsDeletingFolder(true);
    try {
      await api.deleteFolder(folder.id, deleteFiles);
      showToast(`Deleted folder "${folder.name}"`);
      setFolderToDelete(null);
      if (currentFolder === folder.path || currentFolder.startsWith(folder.path + '/')) {
        setCurrentFolder(folder.parent_path || '');
      }
      fetchFolders();
      fetchFiles();
      fetchStats();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete folder');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // File Actions
  const handleDeleteConfirm = async (file: StoredFile) => {
    setIsDeleting(true);
    try {
      await api.deleteFile(file.id);
      showToast(`Deleted ${file.original_name}`);
      setFileToDelete(null);
      if (inspectedFile?.id === file.id) {
        setInspectedFile(null);
      }
      fetchFiles();
      fetchFolders();
      fetchStats();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameConfirm = async (file: StoredFile, newName: string) => {
    try {
      const updated = await api.renameFile(file.id, newName);
      showToast(`Renamed to ${updated.original_name}`);
      setFileToRename(null);
      if (inspectedFile?.id === file.id) {
        setInspectedFile(updated);
      }
      fetchFiles();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to rename file');
    }
  };

  // If not logged in, show Login view
  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onOpenGuide={() => setIsGuideOpen(true)}
        />
        <DeploymentGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex font-sans text-zinc-100 selection:bg-orange-500 selection:text-white antialiased">
      {/* Sidebar: Navigation, categories, system tools, storage capacity widget */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        activeCategory={category}
        onSelectCategory={(cat) => {
          setCategory(cat);
          setActiveView('files');
        }}
        stats={stats}
        onOpenUpload={() => handleOpenUpload()}
        onOpenTester={() => setIsTesterOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <Navbar
          storageStats={stats}
          activeCategory={category}
          activeView={activeView}
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            if (activeView !== 'files') setActiveView('files');
          }}
          onOpenUpload={() => handleOpenUpload()}
          onRefresh={handleRefresh}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          loading={loading}
        />

        {/* Dashboard Main Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {activeView === 'overview' ? (
            <div className="space-y-6">
              <DashboardOverview
                stats={stats}
                onSelectCategory={(cat) => {
                  setCategory(cat);
                  setActiveView('files');
                }}
                onOpenUpload={() => handleOpenUpload()}
                onViewFiles={() => setActiveView('files')}
              />

              {/* Recent Files Section on Overview page */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Recent Uploaded Files</h3>
                  <button
                    onClick={() => setActiveView('files')}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
                  >
                    View All Files ({files.length}) →
                  </button>
                </div>
                <FileList
                  files={files.slice(0, 8)}
                  folders={folders}
                  currentFolder={currentFolder}
                  onCurrentFolderChange={setCurrentFolder}
                  search={search}
                  onSearchChange={setSearch}
                  category={category}
                  onCategoryChange={setCategory}
                  sort={sort}
                  onSortChange={setSort}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onSelectFile={(f) => setInspectedFile(f)}
                  onDeleteFile={(f) => setFileToDelete(f)}
                  onRenameFile={(f) => setFileToRename(f)}
                  onOpenUpload={(target) => handleOpenUpload(target)}
                  onOpenCreateFolder={() => setIsCreateFolderOpen(true)}
                  onRenameFolder={(f) => setFolderToRename(f)}
                  onDeleteFolder={(f) => setFolderToDelete(f)}
                  onDropFilesToFolder={(f, dropped) => {
                    handleOpenUpload(f.path);
                  }}
                  onDropFilesToCurrent={(dropped) => {
                    handleOpenUpload(currentFolder);
                  }}
                  loading={loading}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category tabs switcher inside Files view */}
              <StorageStatsBar
                stats={stats}
                activeCategory={category}
                onSelectCategory={(cat) => setCategory(cat)}
              />

              {/* Full File & Folder Explorer Browser */}
              <FileList
                files={files}
                folders={folders}
                currentFolder={currentFolder}
                onCurrentFolderChange={setCurrentFolder}
                search={search}
                onSearchChange={setSearch}
                category={category}
                onCategoryChange={setCategory}
                sort={sort}
                onSortChange={setSort}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onSelectFile={(f) => setInspectedFile(f)}
                onDeleteFile={(f) => setFileToDelete(f)}
                onRenameFile={(f) => setFileToRename(f)}
                onOpenUpload={(target) => handleOpenUpload(target)}
                onOpenCreateFolder={() => setIsCreateFolderOpen(true)}
                onRenameFolder={(f) => setFolderToRename(f)}
                onDeleteFolder={(f) => setFolderToDelete(f)}
                onDropFilesToFolder={(f, dropped) => {
                  handleOpenUpload(f.path);
                }}
                onDropFilesToCurrent={(dropped) => {
                  handleOpenUpload(currentFolder);
                }}
                loading={loading}
              />
            </div>
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141418] text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-xl shadow-black border border-orange-500/30 flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <FileUploader
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        targetFolder={uploadTargetFolder}
        availableFolders={folders}
      />

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        currentPath={currentFolder}
        onCreate={handleCreateFolder}
      />

      <RenameFolderModal
        folder={folderToRename}
        isOpen={!!folderToRename}
        onClose={() => setFolderToRename(null)}
        onRename={handleRenameFolder}
      />

      <ConfirmDeleteFolderModal
        folder={folderToDelete}
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleDeleteFolderConfirm}
        deleting={isDeletingFolder}
      />

      <FileDetailModal
        file={inspectedFile}
        onClose={() => setInspectedFile(null)}
        onDelete={(f) => {
          setFileToDelete(f);
        }}
        onRename={handleRenameConfirm}
      />

      <DirectTesterModal
        isOpen={isTesterOpen}
        onClose={() => setIsTesterOpen(false)}
        files={files}
      />

      <DeploymentGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRefresh={() => {
          fetchFiles();
          fetchFolders();
          fetchStats();
        }}
      />

      <ConfirmDeleteModal
        file={fileToDelete}
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleDeleteConfirm}
        deleting={isDeleting}
      />

      <RenameModal
        file={fileToRename}
        isOpen={!!fileToRename}
        onClose={() => setFileToRename(null)}
        onRename={handleRenameConfirm}
      />
    </div>
  );
}
