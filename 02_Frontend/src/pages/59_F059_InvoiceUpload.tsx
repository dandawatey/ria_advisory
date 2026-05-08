import { useState, useCallback } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import FileDropZone from "../components/upload/FileDropZone";
import FileList from "../components/upload/FileList";
import UploadProgress from "../components/upload/UploadProgress";
import BatchNotes from "../components/upload/BatchNotes";
import { uploadInvoices } from "../api/client";
import type { UploadedFile, UploadSession } from "../types/index";

export default function InvoiceUploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState("");
  const [session, setSession] = useState<UploadSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setError(null);
    const uploaded: UploadedFile[] = newFiles.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      status: "pending",
      progress: 0,
      file: f,
    }));
    setFiles((prev) => [...prev, ...uploaded]);
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleUpload = useCallback(async () => {
    if (!files.length) {
      setError("Add files before uploading");
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const fileArray = files.map(f => f.file).filter(Boolean) as File[];
      const result = await uploadInvoices(fileArray, notes);
      setSession(result);
      setProgress(100);
      setFiles([]);
      setNotes("");

      setTimeout(() => {
        setProgress(0);
        setSession(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [files, notes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Invoice Upload</h1>
          <p className="text-slate-600">Drag & drop PDF or CSV invoices. Batch support. Max 50 files.</p>
        </div>

        {error && (
          <div
            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Upload Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {session && (
          <div
            className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3"
            role="alert"
            aria-live="polite"
          >
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Upload Complete</p>
              <p className="text-green-700 text-sm">
                {session.file_count} file(s) uploaded. Session ID: {session.session_id}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <FileDropZone onFilesAdded={handleFilesAdded} disabled={uploading} />
            <FileList files={files} onRemove={handleRemoveFile} disabled={uploading} />
          </div>

          <div className="space-y-6">
            <BatchNotes value={notes} onChange={setNotes} disabled={uploading} />
            <UploadProgress
              total={files.length}
              progress={progress}
              uploading={uploading}
              onUpload={handleUpload}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
