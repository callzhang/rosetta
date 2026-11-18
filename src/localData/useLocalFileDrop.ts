import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { droppedFiles, selectFiles } from './drop';
import type { LocalFile } from './files';

export function useLocalFileDrop(options: {
  disabled: boolean;
  onFiles: (files: LocalFile[]) => void;
  onError: (error: Error) => void;
}) {
  const [collecting, setCollecting] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const dropzone = useDropzone({
    noClick: true,
    noKeyboard: true,
    noDragEventsBubbling: true,
    disabled: options.disabled || collecting,
    async getFilesFromEvent(event) {
      const dropping = 'type' in event && event.type === 'drop';
      if (dropping && active.current) setCollecting(true);
      try {
        return await selectFiles(event);
      } finally {
        if (dropping && active.current) setCollecting(false);
      }
    },
    onDropAccepted(files) {
      if (active.current) options.onFiles(droppedFiles(files));
    },
    onError(error) {
      if (active.current) options.onError(error);
    },
  });
  return {
    getRootProps: dropzone.getRootProps,
    dragging: dropzone.isDragActive,
    collecting,
  };
}
