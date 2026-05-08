import { FileText } from "lucide-react";

interface BatchNotesProps {
  value: string;
  onChange: (notes: string) => void;
  disabled?: boolean;
}

export default function BatchNotes({ value, onChange, disabled = false }: BatchNotesProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <label htmlFor="batch-notes" className="block font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Batch Notes
      </label>
      <textarea
        id="batch-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={500}
        placeholder="Optional notes about this batch (e.g., source, date range, any special handling)"
        className={`w-full h-24 px-4 py-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-transparent transition-colors text-sm ${disabled ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white text-slate-900"}`}
        aria-label="Batch notes"
      />
      <div className="mt-2 text-xs text-slate-500">
        {value.length} / 500 characters
      </div>
    </div>
  );
}
