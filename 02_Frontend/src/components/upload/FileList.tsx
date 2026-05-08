import { X, FileText, AlertCircle } from "lucide-react";
import type { UploadedFile } from "../../types/index";

interface FileListProps {
  files: UploadedFile[];
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

export default function FileList({ files, onRemove, disabled = false }: FileListProps) {
  if (!files.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
        <p className="text-slate-500">No files selected yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {files.length} file{files.length !== 1 ? "s" : ""} selected
        </h2>
      </div>
      <ul className="divide-y divide-slate-200">
        {files.map((file) => (
          <li key={file.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              {file.error && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {file.error}
                </p>
              )}
            </div>
            <button
              onClick={() => onRemove(file.id)}
              disabled={disabled}
              aria-label={`Remove ${file.name}`}
              className={`ml-4 flex-shrink-0 p-2 rounded-md transition-colors ${disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"}`}
            >
              <X className="w-5 h-5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
