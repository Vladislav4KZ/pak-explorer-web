
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
import { Label } from '@/components/ui/label';
import { Slider } from '../ui/slider';

export interface SaveOptions {
    compressionLevel: number;
}

interface SaveDialogProps {
  fileName: string;
  onClose: () => void;
  onConfirm: (options: SaveOptions) => void;
}

const compressionLabels: { [key: number]: string } = {
    0: "Store (No compression)",
    1: "Fastest",
    3: "Fast",
    6: "Normal (Default)",
    9: "Maximum",
};


export function SaveDialog({
  fileName,
  onClose,
  onConfirm,
}: SaveDialogProps) {
  const [compressionLevel, setCompressionLevel] = useState(6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ compressionLevel });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save PK3 Archive</DialogTitle>
            <DialogDescription>
              Choose compression settings for "{fileName.replace(/\.(pak|pk3|zip)$/i, '')}.pk3".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
                <div className='flex justify-between items-baseline'>
                    <Label htmlFor="compression">Compression Level</Label>
                    <span className='text-sm text-muted-foreground'>{compressionLabels[compressionLevel]}</span>
                </div>
              <Slider 
                id="compression"
                min={0}
                max={9}
                step={1}
                defaultValue={[6]}
                onValueChange={(value) => setCompressionLevel(value[0])}
              />
               <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Store</span>
                <span>Max</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save Archive</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
