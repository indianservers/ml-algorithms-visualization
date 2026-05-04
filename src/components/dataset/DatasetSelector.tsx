import React, { useRef } from 'react';
import { Database, Upload, Shuffle } from 'lucide-react';
import { Tabs } from '../common/Tabs';

interface DatasetSelectorProps {
  sampleOptions: { label: string; id: string }[];
  onSampleSelect: (id: string) => void;
  onCSVUpload: (content: string, filename: string) => void;
  onGenerate?: () => void;
  selectedSample?: string;
}

export const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  sampleOptions, onSampleSelect, onCSVUpload, onGenerate, selectedSample
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      onCSVUpload(content, file.name);
    };
    reader.readAsText(file);
  };

  return (
    <Tabs
      tabs={[
        { id: 'sample', label: 'Sample Data', icon: <Database size={12} /> },
        { id: 'upload', label: 'Upload CSV', icon: <Upload size={12} /> },
        ...(onGenerate ? [{ id: 'generate', label: 'Generate', icon: <Shuffle size={12} /> }] : []),
      ]}
    >
      {activeTab => (
        <div>
          {activeTab === 'sample' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sampleOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => onSampleSelect(opt.id)}
                  className={`px-3 py-2 text-xs rounded-lg border text-left transition-colors ${
                    selectedSample === opt.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'upload' && (
            <div className="text-center">
              <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 cursor-pointer hover:border-blue-400 transition-colors"
              >
                <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload CSV or JSON file</p>
                <p className="text-xs text-gray-400 mt-1">First row should be column headers</p>
              </div>
            </div>
          )}
          {activeTab === 'generate' && onGenerate && (
            <div className="text-center py-6">
              <Shuffle size={32} className="mx-auto mb-3 text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Generate a synthetic dataset for this algorithm.</p>
              <button
                onClick={onGenerate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                Generate Dataset
              </button>
            </div>
          )}
        </div>
      )}
    </Tabs>
  );
};
