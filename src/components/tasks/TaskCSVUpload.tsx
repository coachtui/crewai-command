import { useState, type ChangeEvent } from 'react';
import { Button } from '../ui/Button';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CSVRow {
  activityId: string;
  activityName: string;
  duration: string;
  taskName: string; // Combined activityId + activityName
}

interface TaskCSVUploadProps {
  onImport: (tasks: CSVRow[]) => Promise<void>;
  onCancel: () => void;
}

export function TaskCSVUpload({ onImport, onCancel }: TaskCSVUploadProps) {
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setCSVFile(file);
    setErrors([]);
    parseCSV(file);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          setErrors(['CSV file must contain at least a header row and one data row']);
          return;
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate required columns
        const requiredColumns = ['activity id', 'activity name', 'duration'];
        const missingColumns = requiredColumns.filter(col =>
          !headers.some(h => h === col || h === col.replace(' ', '_'))
        );

        if (missingColumns.length > 0) {
          setErrors([`Missing required columns: ${missingColumns.join(', ')}`]);
          return;
        }

        // Find column indices
        const activityIdIndex = headers.findIndex(h => h === 'activity id' || h === 'activity_id');
        const activityNameIndex = headers.findIndex(h => h === 'activity name' || h === 'activity_name');
        const durationIndex = headers.findIndex(h => h === 'duration');

        // Parse data rows
        const rows: CSVRow[] = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = parseCSVLine(line);

          const activityId = values[activityIdIndex]?.trim() || '';
          const activityName = values[activityNameIndex]?.trim() || '';
          const duration = values[durationIndex]?.trim() || '';

          if (!activityId || !activityName) {
            parseErrors.push(`Row ${i}: Activity ID and Activity Name are required`);
            continue;
          }

          // Combine Activity ID and Activity Name into task name
          const taskName = `${activityId} - ${activityName}`;

          rows.push({
            activityId,
            activityName,
            duration,
            taskName
          });
        }

        if (parseErrors.length > 0) {
          setErrors(parseErrors);
        }

        if (rows.length === 0) {
          setErrors(['No valid rows found in CSV file']);
          return;
        }

        setParsedData(rows);
        toast.success(`Parsed ${rows.length} task(s) from CSV`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        setErrors(['Failed to parse CSV file. Please check the format.']);
      }
    };

    reader.onerror = () => {
      setErrors(['Failed to read CSV file']);
    };

    reader.readAsText(file);
  };

  // Helper function to parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error('No tasks to import');
      return;
    }

    setIsLoading(true);
    try {
      await onImport(parsedData);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setCSVFile(null);
    setParsedData([]);
    setErrors([]);
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="font-medium text-text-primary mb-2">CSV Format Requirements</h3>
        <p className="text-sm text-text-secondary mb-2">
          Your CSV file must include the following columns:
        </p>
        <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
          <li><strong>Activity ID</strong>: Unique identifier for the activity (e.g., A1000)</li>
          <li><strong>Activity Name</strong>: Description of the activity</li>
          <li><strong>Duration</strong>: Duration in days (e.g., "5 days" or "5")</li>
        </ul>
        <p className="text-sm text-text-secondary mt-2">
          <strong>Note:</strong> Task name will be set as: "Activity ID - Activity Name"
        </p>
        <p className="text-sm text-text-secondary mt-1">
          <strong>Note:</strong> Start and End dates can be added/adjusted later in the task details.
        </p>
      </div>

      {/* File Upload */}
      {!csvFile ? (
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer bg-bg-secondary hover:bg-bg-hover transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload size={32} className="text-text-secondary mb-3" />
            <p className="text-sm text-text-primary mb-1">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-text-secondary">CSV files only</p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      ) : (
        <div className="border border-border rounded-lg p-4 bg-bg-secondary">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-success" />
              <span className="text-sm font-medium">{csvFile.name}</span>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1 hover:bg-bg-hover rounded transition-colors"
              disabled={isLoading}
            >
              <X size={18} className="text-error" />
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-3 p-3 bg-error/10 border border-error/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-error mb-1">Errors found:</p>
                  <ul className="text-sm text-error space-y-1">
                    {errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-text-primary mb-2">
                Preview ({parsedData.length} task{parsedData.length !== 1 ? 's' : ''})
              </h4>
              <div className="overflow-x-auto max-h-64 border border-border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-bg-tertiary sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-text-primary">Activity ID</th>
                      <th className="px-3 py-2 text-left font-medium text-text-primary">Activity Name</th>
                      <th className="px-3 py-2 text-left font-medium text-text-primary">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-bg-hover">
                        <td className="px-3 py-2 text-text-secondary">{row.activityId}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.activityName}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleImport}
          disabled={parsedData.length === 0 || errors.length > 0 || isLoading}
          className="flex-1"
        >
          {isLoading ? 'Creating Tasks...' : `Create ${parsedData.length} Task${parsedData.length !== 1 ? 's' : ''}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
