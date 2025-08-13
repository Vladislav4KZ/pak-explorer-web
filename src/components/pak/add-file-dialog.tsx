
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

interface AddFileDialogProps {
  initialName: string;
  fileData: ArrayBuffer;
  onClose: () => void;
  onConfirm: (name: string, data: ArrayBuffer) => void;
}

export function AddFileDialog({
  initialName,
  fileData,
  onClose,
  onConfirm,
}: AddFileDialogProps) {
  const [name, setName] = useState(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim(), fileData);
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add File to Archive</DialogTitle>
            <DialogDescription>
              Enter a name and path for the new file. Use forward slashes (/) for directories.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Filename
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Add File</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    
