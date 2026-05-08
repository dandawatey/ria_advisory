import { useRef } from "react";
import { Upload } from "lucide-react";

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

export default function FileDropZone({ onFilesAdded, disabled = false }: FileDropZoneProps) {
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      dropRef.current?.classList.add("border-blue-500", "bg-blue-50");
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("border-blue-500", "bg-blue-50");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("border-blue-500", "bg-blue-50");
    if (!disabled) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesAdded(droppedFiles);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      onFilesAdded(selectedFiles);
    }
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop files here or click to select"
      aria-disabled={disabled}
      className={`border-2 border-dashed border-slate-300 rounded-lg p-8 text-center transition-all cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:border-blue-400 hover:bg-blue-50"} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
    >
      <div className="flex flex-col items-center gap-3">
        <Upload className="w-8 h-8 text-slate-400" aria-hidden="true" />
        <div>
          <p className="font-semibold text-slate-900">
            {disabled ? "Uploading..." : "Drag & drop invoices here"}
          </p>
          <p className="text-sm text-slate-500">or click to browse (PDF, CSV)</p>
        </div>
        <p className="text-xs text-slate-400">Max 50 files, 100 MB each</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.csv"
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
        aria-label="File input"
      />
    </div>
  );
}
