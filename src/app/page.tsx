
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, UploadCloud, PlusCircle, FolderOpen, Menu, Loader2, MoreVertical, FileArchive } from 'lucide-react';
import { FileDropzone } from '@/components/pak/file-dropzone';
import { PreviewPane } from '@/components/pak/preview-pane';
import { AddFileDialog } from '@/components/pak/add-file-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { parsePak, createPak, buildFileTree as buildFileTreeUtil, parseZip, createZip } from '@/lib/pak-parser';
import type { PakFileEntry, FileTree as FileTreeType, ArchiveType, ClipboardItem } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddFolderDialog } from '@/components/pak/add-folder-dialog';
import { SaveDialog, type SaveOptions } from '@/components/pak/save-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UnsavedChangesDialog } from '@/components/pak/unsaved-changes-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { FileListPane } from '@/components/pak/file-list-pane';
import { MobileSidebar } from '@/components/pak/mobile-sidebar';

type AppState = 'empty' | 'loaded';


type PendingAction = {
    type: 'open_file';
    file: File;
} | {
    type: 'new_archive';
    archiveType: ArchiveType;
} | null;

async function* getFilesFromEntry(entry: FileSystemEntry): AsyncGenerator<{file: File, path: string}> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    yield { file, path: entry.name }; // Return relative path for folder drop
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let entries: FileSystemEntry[] = [];
    let readEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    while(readEntries.length > 0){
        entries = entries.concat(readEntries);
        readEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    }
    
    for (const child of entries) {
      const nestedFiles = getFilesFromEntry(child);
      for await (const nestedFile of nestedFiles) {
          yield { file: nestedFile.file, path: `${entry.name}/${nestedFile.path}` };
      }
    }
  }
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [appState, setAppState] = useState<AppState>('empty');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [archiveType, setArchiveType] = useState<ArchiveType>('pak');
  const [pakName, setPakName] = useState('new.pak');
  const [isRenamingPak, setIsRenamingPak] = useState(false);
  const [pakEntries, setPakEntries] = useState<PakFileEntry[]>([]);
  const [fileTree, setFileTree] = useState<FileTreeType | null>(null);
  const [selectedFile, setSelectedFile] = useState<PakFileEntry | null>(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<'file' | 'folder' | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveType, setSaveType] = useState<ArchiveType>('pk3');
  const [clipboard, setClipboard] = useState<ClipboardItem>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  const isMobile = useIsMobile();
  const { toast } = useToast();
  const openFileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const buildFileTree = useCallback((entries: PakFileEntry[]) => {
    const tree = buildFileTreeUtil(entries);
    setFileTree(tree);
  }, []);
  
  const setEntries = useCallback((entries: PakFileEntry[], fromLoad: boolean = false) => {
    setPakEntries(entries);
    buildFileTree(entries);
    if (!fromLoad) {
      setIsDirty(true);
    }
  }, [buildFileTree]);
  
  const handlePakNameChange = (newName: string) => {
      setPakName(newName);
      setIsDirty(true);
  }
  
  const resetStateForNewArchive = useCallback((type: ArchiveType = 'pk3') => {
    setArchiveType(type);
    const newName = type === 'pak' ? 'new.pak' : 'new.pk3';
    setPakName(newName);
    setEntries([], true);
    setFileTree(null);
    setSelectedFile(null);
    setAppState('loaded');
    setIsDirty(false);
    toast({
      title: `New ${type.toUpperCase()} archive created`,
      description: 'You can now add files to the new archive.',
    });
  }, [setEntries, toast]);

  const handleFileLoad = useCallback(
    async (file: File) => {
      setIsLoadingFile(true);
      setPakName(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        let entries: PakFileEntry[];
        
        if (fileExt === 'pk3' || fileExt === 'zip') {
          entries = await parseZip(buffer);
          setArchiveType('pk3');
          toast({
            title: 'PK3/ZIP file loaded',
            description: `${file.name} successfully parsed with ${entries.length} file(s).`,
          });
        } else {
          entries = await parsePak(buffer);
          setArchiveType('pak');
           toast({
            title: 'PAK file loaded',
            description: `${file.name} successfully parsed with ${entries.length} file(s).`,
          });
        }
        
        setEntries(entries, true);
        setSelectedFile(null);
        setAppState('loaded');
        setIsDirty(false);
        setPendingAction(null);

      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error loading archive',
          description: error instanceof Error ? error.message : 'An unknown error occurred.',
        });
      } finally {
        setIsLoadingFile(false);
      }
    },
    [setEntries, toast]
  );
  
  const handleNewArchive = useCallback((type: ArchiveType = 'pk3') => {
    if (isDirty) {
        setPendingAction({ type: 'new_archive', archiveType: type });
    } else {
        resetStateForNewArchive(type);
    }
  }, [isDirty, resetStateForNewArchive]);

  const handleSave = useCallback(async (type: ArchiveType, options?: SaveOptions) => {
    setIsSaveDialogOpen(false);
    if (pakEntries.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot save',
        description: 'No files to save in the archive.',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      let archiveBuffer: ArrayBuffer;
      const baseName = pakName.replace(/\.(pak|pk3|zip)$/i, '');
      const downloadName = type === 'pak' ? `${baseName}.pak` : `${baseName}.pk3`;
      
      if (type === 'pak') {
        archiveBuffer = await createPak(pakEntries);
      } else {
        archiveBuffer = await createZip(pakEntries, options?.compressionLevel);
      }
      
      const blob = new Blob([archiveBuffer], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsDirty(false);
      toast({
        title: `${type.toUpperCase()} Saved`,
        description: `${link.download} has been saved successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: `Error saving ${type.toUpperCase()} file`,
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
        setIsSaving(false);
    }
  }, [pakEntries, pakName, toast]);

  const handleAddNewFile = useCallback(
    (name: string, data: ArrayBuffer) => {
      const normalizedName = name.replace(/\\/g, '/');
      const existingIndex = pakEntries.findIndex((e) => e.path === normalizedName);
      const newEntry: PakFileEntry = {
        name: normalizedName.split('/').pop() || '',
        path: normalizedName,
        data,
        size: data.byteLength,
        offset: 0, // Offset will be recalculated on save
      };

      let updatedEntries;
      if (existingIndex > -1) {
        updatedEntries = [...pakEntries];
        updatedEntries[existingIndex] = newEntry;
        toast({
          title: 'File replaced',
          description: `Replaced "${normalizedName}" in the archive.`,
        });
      } else {
        updatedEntries = [...pakEntries, newEntry];
        toast({
          title: 'File added',
          description: `Added "${normalizedName}" to the archive.`,
        });
      }
      setEntries(updatedEntries);
    },
    [pakEntries, toast, setEntries]
  );
  
  const handleAddDroppedFile = useCallback(async (file: File, destPath?: string) => {
    const path = destPath ? `${destPath}/${file.name}` : file.name;
    const data = await file.arrayBuffer();
    handleAddNewFile(path, data);
  }, [handleAddNewFile]);

  const handleAddDroppedFolder = useCallback(async (entry: FileSystemEntry, destPath?: string) => {
      let addedCount = 0;
      let newEntries = [...pakEntries];
      for await (const {file, path: relativePath} of getFilesFromEntry(entry)) {
          const newPath = destPath ? `${destPath}/${relativePath}` : relativePath;
          const data = await file.arrayBuffer();
          const existingIndex = newEntries.findIndex((e) => e.path === newPath);
          const newEntry: PakFileEntry = {
              name: newPath.split('/').pop() || '',
              path: newPath,
              data,
              size: data.byteLength,
              offset: 0,
          };
          if (existingIndex > -1) {
              newEntries[existingIndex] = newEntry;
          } else {
              newEntries.push(newEntry);
          }
          addedCount++;
      }
      setEntries(newEntries);
      toast({
          title: 'Folder Added',
          description: `Added ${addedCount} files from "${entry.name}".`
      });
  }, [pakEntries, setEntries, toast]);
  
  const handleItemDropOnEmpty = useCallback(async (item: DataTransferItem) => {
    const entry = item.webkitGetAsEntry();
    if (!entry) return;

    if (appState === 'empty') {
        resetStateForNewArchive('pk3'); // Create a default archive first
    }
    
    // We need to wait for state to update, so we use a timeout
    setTimeout(async () => {
        if (entry.isFile) {
            const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
            await handleAddDroppedFile(file, '');
        } else if (entry.isDirectory) {
            await handleAddDroppedFolder(entry, '');
        }
    }, 0);

}, [appState, resetStateForNewArchive, handleAddDroppedFile, handleAddDroppedFolder]);


  const handleAddNewFolder = useCallback((folderPath: string) => {
      const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
      if (!normalizedPath) return;

      const placeholderPath = `${normalizedPath}/.placeholder`;

      const existingIndex = pakEntries.findIndex((e) => e.path.startsWith(normalizedPath + '/'));
      if(existingIndex > -1) {
          toast({
              variant: 'destructive',
              title: 'Folder exists',
              description: `A file or folder with the name "${normalizedPath}" already exists.`,
          });
          return;
      }

      // Add a placeholder file to make the folder exist in the PAK structure
      const placeholderEntry: PakFileEntry = {
          name: '.placeholder',
          path: placeholderPath,
          data: new ArrayBuffer(0),
          size: 0,
          offset: 0,
      };

      const updatedEntries = [...pakEntries, placeholderEntry];
      setEntries(updatedEntries);

      toast({
          title: 'Folder added',
          description: `Added folder "${normalizedPath}" to the archive.`,
      });

      setIsAddingFolder(false);
  }, [pakEntries, toast, setEntries]);

  const handleExtractFile = (file: PakFileEntry) => {
    const blob = new Blob([file.data], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMove = useCallback((sourcePath: string, destPath: string) => {
    const isFolder = !pakEntries.some(e => e.path === sourcePath);
    const sourceName = sourcePath.split('/').pop() || '';
    const newBasePath = destPath ? `${destPath}/${sourceName}` : sourceName;

    if (sourcePath === destPath || newBasePath.startsWith(`${sourcePath}/`)) {
        toast({ variant: 'destructive', title: 'Invalid Move', description: 'Cannot move a folder into itself.'});
        return;
    }

    // Check if destination exists
    const destinationExists = pakEntries.some(e => e.path === newBasePath || e.path.startsWith(`${newBasePath}/`));
    if (destinationExists) {
        toast({ variant: 'destructive', title: 'Error', description: `An item named "${sourceName}" already exists in "${destPath || 'root'}".`});
        return;
    }

    let updatedEntries;
    if (isFolder) {
        updatedEntries = pakEntries.map(entry => {
            if (entry.path.startsWith(`${sourcePath}/`)) {
                const newPath = entry.path.replace(sourcePath, newBasePath);
                return { ...entry, path: newPath, name: newPath.split('/').pop() || '' };
            }
            return entry;
        });
    } else {
        updatedEntries = pakEntries.map(entry => {
            if (entry.path === sourcePath) {
                return { ...entry, path: newBasePath, name: sourceName };
            }
            return entry;
        });
    }
    setEntries(updatedEntries);
    if (selectedFile?.path.startsWith(sourcePath)) {
        setSelectedFile(null);
    }
    toast({ title: 'Moved', description: `Moved "${sourceName}" to "${destPath || 'root'}".` });
  }, [pakEntries, setEntries, selectedFile, toast]);

  const handleRenameConfirm = useCallback((oldPath: string, newPath: string) => {
    if (oldPath === newPath) {
      setRenamingPath(null);
      return;
    }
    
    const isFolderRename = !pakEntries.some(e => e.path === oldPath);
    let updatedEntries;
    
    if (isFolderRename) {
        updatedEntries = pakEntries.map(entry => {
            if (entry.path.startsWith(`${oldPath}/`)) {
                const remainingPath = entry.path.substring(oldPath.length);
                const updatedPath = `${newPath}${remainingPath}`;
                return { ...entry, path: updatedPath, name: updatedPath.split('/').pop() || '' };
            }
            return entry;
        });
    } else {
         updatedEntries = pakEntries.map(entry => {
            if (entry.path === oldPath) {
                return { ...entry, path: newPath, name: newPath.split('/').pop() || '' };
            }
            return entry;
        });
    }

    setEntries(updatedEntries);

    if (selectedFile && selectedFile.path.startsWith(oldPath)) {
        const newSelectedPath = selectedFile.path.replace(oldPath, newPath);
        const newSelectedFile = updatedEntries.find(e => e.path === newSelectedPath);
        setSelectedFile(newSelectedFile || null);
    }
    
    setRenamingPath(null);
    toast({ title: "Renamed", description: `"${oldPath}" renamed to "${newPath}"` });
  }, [pakEntries, setEntries, selectedFile, toast]);

  const handleDelete = useCallback(() => {
    if (!deletingPath) return;

    let updatedEntries;
    if (deletingType === 'file') {
      updatedEntries = pakEntries.filter(entry => entry.path !== deletingPath);
    } else { // folder
      updatedEntries = pakEntries.filter(entry => !entry.path.startsWith(`${deletingPath}/`) && entry.path !== deletingPath);
    }
    
    setEntries(updatedEntries);

    if (selectedFile && selectedFile.path.startsWith(deletingPath)) {
      setSelectedFile(null);
    }

    toast({ title: "Deleted", description: `Deleted "${deletingPath}"` });
    setDeletingPath(null);
    setDeletingType(null);
  }, [deletingPath, deletingType, pakEntries, setEntries, selectedFile, toast]);

  const confirmDelete = () => {
    handleDelete();
  };

  const handleSaveClick = (type: ArchiveType) => {
    if (type === 'pak') {
      handleSave('pak');
    } else {
      setSaveType('pk3');
      setIsSaveDialogOpen(true);
    }
  };

  const handleClipboardAction = (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => {
    setClipboard({ type, itemType, path });
    toast({ title: type === 'copy' ? 'Copied' : 'Cut', description: `"${path}" to clipboard.` });
  };

  const handlePaste = useCallback((destPath: string) => {
    if (!clipboard) return;

    const { type, itemType, path: sourcePath } = clipboard;
    const sourceName = sourcePath.split('/').pop() || '';
    const newBasePath = destPath ? `${destPath}/${sourceName}` : sourceName;
    
    if (newBasePath.startsWith(sourcePath + '/')) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot paste a folder into itself.' });
      return;
    }
    
    let entriesToAdd: PakFileEntry[] = [];
    let entriesToRemove: string[] = [];

    if (itemType === 'folder') {
      pakEntries.forEach(entry => {
        if (entry.path.startsWith(`${sourcePath}/`)) {
          const newPath = entry.path.replace(sourcePath, newBasePath);
          entriesToAdd.push({ ...entry, path: newPath, name: newPath.split('/').pop() || '' });
          if (type === 'cut') entriesToRemove.push(entry.path);
        }
      });
    } else {
      const sourceFile = pakEntries.find(e => e.path === sourcePath);
      if (sourceFile) {
        entriesToAdd.push({ ...sourceFile, path: newBasePath, name: newBasePath.split('/').pop() || '' });
        if (type === 'cut') entriesToRemove.push(sourcePath);
      }
    }
    
    // Check for conflicts
    const conflict = entriesToAdd.some(add => pakEntries.some(existing => existing.path === add.path));
    if (conflict) {
      toast({ variant: 'destructive', title: 'Error', description: `An item named "${sourceName}" already exists in "${destPath}".` });
      return;
    }
    
    let updatedEntries = [...pakEntries];
    if (type === 'cut') {
      updatedEntries = updatedEntries.filter(e => !entriesToRemove.includes(e.path));
    }
    updatedEntries = [...updatedEntries, ...entriesToAdd];
    
    setEntries(updatedEntries);
    toast({ title: 'Pasted', description: `Pasted "${sourceName}" into "${destPath}".` });
    if(type === 'cut') setClipboard(null);
  }, [clipboard, pakEntries, toast, setEntries]);


  if (!isClient) {
    return null;
  }
  
  const handleAddFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const data = await file.arrayBuffer();
      handleAddNewFile(file.name, data);
    }
  };
  
  const handleOpenFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        if (isDirty) {
          setPendingAction({ type: 'open_file', file });
        } else {
          handleFileLoad(file);
        }
    }
  };

  const triggerOpenFileInput = () => {
    openFileInputRef.current?.click();
  };

  const handleUnsavedDialogAction = async (action: 'save-pak' | 'save-pk3' | 'dont-save') => {
    if (action === 'save-pak') {
        await handleSave('pak');
    } else if (action === 'save-pk3') {
        await handleSave('pk3');
    }
    
    if (pendingAction?.type === 'open_file') {
        handleFileLoad(pendingAction.file);
    } else if (pendingAction?.type === 'new_archive') {
        resetStateForNewArchive(pendingAction.archiveType);
    }
    setPendingAction(null); // Clear pending action
  };
  
  const handleFileDropOnEmpty = async (file: File) => {
      const isArchive = ['pak', 'pk3', 'zip'].includes(file.name.split('.').pop()?.toLowerCase() || '');
      if (isArchive) {
        if (isDirty) {
          setPendingAction({ type: 'open_file', file });
        } else {
          handleFileLoad(file);
        }
      } else {
        if(appState === 'empty') {
            resetStateForNewArchive('pk3'); // Create a default archive first
        }
         // We need to wait for state to update, so we use a timeout
        setTimeout(async () => {
            const data = await file.arrayBuffer();
            handleAddNewFile(file.name, data);
        }, 0);
      }
    };
  
  const fileListPaneProps = {
    pakName,
    isDirty,
    pakEntries,
    fileTree,
    selectedFile,
    renamingPath,
    clipboard,
    isRenamingPak,
    onRenameStart: setRenamingPath,
    onRenameConfirm: handleRenameConfirm,
    onDeleteStart: (path: string, type: 'file' | 'folder') => { setDeletingPath(path); setDeletingType(type); },
    onMove: handleMove,
    onClipboardAction: handleClipboardAction,
    onPaste: handlePaste,
    onFileDrop: handleAddDroppedFile,
    onFolderDrop: handleAddDroppedFolder,
    onAddFile: () => document.getElementById('add-file-input')?.click(),
    onAddFolder: () => setIsAddingFolder(true),
    onSelectFile: (file: PakFileEntry) => {
        setSelectedFile(file);
        if (isMobile) setIsMobileMenuOpen(false);
    },
    setIsRenamingPak,
    setPakName: handlePakNameChange,
    toast,
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background font-sans">
      <input id="add-file-input" type="file" className="hidden" onChange={handleAddFileInput} />
      <input ref={openFileInputRef} type="file" className="hidden" onChange={handleOpenFileInput} accept=".pak,.pk3,.zip" />

      {(isLoadingFile || isSaving) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground">
                  {isSaving ? 'Saving archive...' : 'Loading archive...'}
                </p>
            </div>
        </div>
      )}

      {isAddingFolder && (
          <AddFolderDialog 
            onClose={() => setIsAddingFolder(false)}
            onConfirm={handleAddNewFolder}
          />
      )}
      {isSaveDialogOpen && (
        <SaveDialog 
            onClose={() => setIsSaveDialogOpen(false)}
            onConfirm={(options) => handleSave(saveType, options)}
            fileName={pakName}
        />
      )}
      <AlertDialog open={!!deletingPath} onOpenChange={() => { setDeletingPath(null); setDeletingType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingPath}"{deletingType === 'folder' && ' and all its contents'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog 
        isOpen={!!pendingAction && isDirty}
        onAction={handleUnsavedDialogAction}
        onCancel={() => setPendingAction(null)}
      />

      {isMobile && appState === 'loaded' && (
        <MobileSidebar 
          isOpen={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
        >
          <FileListPane {...fileListPaneProps} />
        </MobileSidebar>
      )}

      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <div className="flex items-center gap-3">
          {isMobile && appState === 'loaded' ? (
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                  <Menu />
              </Button>
          ) : (
             <Box className="h-7 w-7 text-primary" />
          )}

          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">Pak Explorer</h1>
        </div>
        <div className="flex items-center gap-2">
            {(appState === 'loaded') && (
              <>
                <div className="hidden md:flex items-center gap-2">
                    <Button variant="outline" onClick={triggerOpenFileInput}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Open
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button>
                          Save As...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleSaveClick('pak')}>
                            <Box className="mr-2 h-4 w-4" /> Save as PAK
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSaveClick('pk3')}>
                             <FileArchive className="mr-2 h-4 w-4" /> Save as PK3
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => handleNewArchive()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> New Archive
                    </Button>
                </div>
                 <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={triggerOpenFileInput}>
                                <FolderOpen className="mr-2 h-4 w-4" /> Open Archive...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleNewArchive()}>
                                <PlusCircle className="mr-2 h-4 w-4" /> New Archive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSaveClick('pak')}>
                                <Box className="mr-2 h-4 w-4" /> Save as PAK
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSaveClick('pk3')}>
                                <FileArchive className="mr-2 h-4 w-4" /> Save as PK3
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </>
            )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {appState === 'empty' ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4">
              <FileDropzone 
                onFileLoad={handleFileLoad} 
                onItemDrop={handleItemDropOnEmpty}
                icon={<UploadCloud size={64} />} 
                accept=".pak,.pk3,.zip"
              />
              <Button size="lg" onClick={() => handleNewArchive()}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Or Create a New Empty Archive
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col md:flex-row">
            <div className={cn("flex-shrink-0 border-r bg-card/50", 
                isMobile ? "hidden" : "md:w-1/3 md:max-w-sm md:flex")}
            >
                <FileListPane {...fileListPaneProps} />
            </div>

            <section className="flex-1 flex flex-col overflow-y-auto">
              <PreviewPane
                file={selectedFile}
                onExtract={handleExtractFile}
                key={selectedFile?.path}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}



    

    