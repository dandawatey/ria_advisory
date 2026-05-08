import { Upload, CheckCircle } from "lucide-react";

interface UploadProgressProps {
  total: number;
  progress: number;
  uploading: boolean;
  onUpload: () => void;
}

export default function UploadProgress({
  total,
  progress,
  uploading,
  onUpload,
}: UploadProgressProps) {
  const isComplete = progress === 100 && !uploading;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sticky top-6">
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="progress-bar" className="text-sm font-medium text-slate-900">
              Upload Progress
            </label>
            <span className="text-sm font-semibold text-slate-600">{progress}%</span>
          </div>
          <div
            id="progress-bar"
            className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className={`h-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={onUpload}
          disabled={!total || uploading || isComplete}
          aria-label={
            isComplete
              ? "Upload complete"
              : !total
                ? "Add files before uploading"
                : "Upload files"
          }
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isComplete
              ? "bg-green-100 text-green-700 cursor-default"
              : !total || uploading
                ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
          }`}
        >
          {isComplete ? (
            <>
              <CheckCircle className="w-5 h-5" />
              Complete
            </>
          ) : uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Upload ({total})
            </>
          )}
        </button>

        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-600">
            {total ? `${total} file${total !== 1 ? "s" : ""} ready` : "No files selected"}
          </p>
        </div>
      </div>
    </div>
  );
}
