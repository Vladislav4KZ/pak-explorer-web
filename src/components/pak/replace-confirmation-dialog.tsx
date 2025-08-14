
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConflictFile } from '@/types';
import { calculateHash } from '@/lib/pak-parser';
import { Skeleton } from '../ui/skeleton';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReplaceConfirmationDialogProps {
  conflict: ConflictFile;
  onResolve: (action: 'replace' | 'skip' | 'replaceAll' | 'skipAll') => void;
  remainingCount: number;
}

interface FileInfo {
    size: number;
    hash: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export function ReplaceConfirmationDialog({ conflict, onResolve, remainingCount }: ReplaceConfirmationDialogProps) {
    const [existingInfo, setExistingInfo] = useState<FileInfo | null>(null);
    const [newInfo, setNewInfo] = useState<FileInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [copiedHash, setCopiedHash] = useState<'existing' | 'new' | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const getInfo = async () => {
            setLoading(true);
            const [existingHash, newHash] = await Promise.all([
                calculateHash(conflict.existingFile.data),
                calculateHash(conflict.newFile.data)
            ]);
            setExistingInfo({ size: conflict.existingFile.size, hash: existingHash });
            setNewInfo({ size: conflict.newFile.size, hash: newHash });
            setLoading(false);
        };
        getInfo();
    }, [conflict]);

    const handleCopy = (hash: string | undefined, type: 'existing' | 'new') => {
        if (!hash) return;
        navigator.clipboard.writeText(hash).then(() => {
            setCopiedHash(type);
            toast({ title: 'Copied to clipboard!', description: 'The full hash has been copied.'});
            setTimeout(() => setCopiedHash(null), 2000);
        }).catch(err => {
            console.error('Failed to copy hash: ', err);
            toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy hash to clipboard.'});
        });
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onResolve('skipAll')}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>File Conflict</DialogTitle>
                    <DialogDescription>
                        A file named "{conflict.newFile.path}" already exists in the archive. Do you want to replace it?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pr-2">Property</TableHead>
                                <TableHead className="px-2">Existing File</TableHead>
                                <TableHead className="pl-2">New File</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium pr-2">Size</TableCell>
                                <TableCell className="px-2">{loading ? <Skeleton className="h-4 w-20" /> : formatBytes(existingInfo!.size)}</TableCell>
                                <TableCell className="pl-2">{loading ? <Skeleton className="h-4 w-20" /> : formatBytes(newInfo!.size)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium pr-2">SHA-256</TableCell>
                                <TableCell className="px-2">
                                    {loading ? <Skeleton className="h-4 w-24" /> : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs truncate" title={existingInfo?.hash}>{existingInfo?.hash.substring(0, 12)}...</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleCopy(existingInfo?.hash, 'existing')}>
                                                {copiedHash === 'existing' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="pl-2">
                                    {loading ? <Skeleton className="h-4 w-24" /> : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs truncate" title={newInfo?.hash}>{newInfo?.hash.substring(0, 12)}...</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleCopy(newInfo?.hash, 'new')}>
                                                 {copiedHash === 'new' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter className="flex-col-reverse items-center gap-y-4 sm:flex-row sm:justify-between sm:gap-x-2">
                     <div className="text-sm text-muted-foreground text-center sm:text-left">
                        {remainingCount > 0 && <p>There are {remainingCount} more conflicting files.</p>}
                    </div>
                     <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" onClick={() => onResolve('skip')} className="flex-1">Skip</Button>
                        {remainingCount > 0 && <Button variant="secondary" onClick={() => onResolve('skipAll')} className="flex-1">Skip All</Button>}
                        <Button onClick={() => onResolve('replace')} className="flex-1">Replace</Button>
                        {remainingCount > 0 && <Button onClick={() => onResolve('replaceAll')} className="flex-1">Replace All</Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
