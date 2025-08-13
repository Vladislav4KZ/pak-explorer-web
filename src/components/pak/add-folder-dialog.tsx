
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddFolderDialogProps {
  onClose: () => void;
  onConfirm: (path: string) => void;
}

export function AddFolderDialog({ onClose, onConfirm }: AddFolderDialogProps) {
  const [path, setPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) {
      onConfirm(path.trim());
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Folder</DialogTitle>
            <DialogDescription>
              Enter a name and path for the new folder. Use forward slashes (/) for subdirectories.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="path" className="text-right">
                Folder Path
              </Label>
              <Input
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="col-span-3"
                placeholder="e.g. sounds/weapons"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Add Folder</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    