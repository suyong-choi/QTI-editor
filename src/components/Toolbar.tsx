import React from 'react';
import { Download, Upload, FileText, FileSpreadsheet, FileCode, RotateCcw } from 'lucide-react';
import { QtiVersion } from '../lib/types';

interface ToolbarProps {
  onImportCsv: (file: File) => void;
  onImportWord: (file: File) => void;
  onImportQti: (file: File) => void;
  onExportCsv: () => void;
  onExportWord: () => void;
  onExportQti: (version: QtiVersion) => void;
  onReset: () => void;
  resetConfirm: boolean;
}

export function Toolbar({ onImportCsv, onImportWord, onImportQti, onExportCsv, onExportWord, onExportQti, onReset, resetConfirm }: ToolbarProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, handler: (file: File) => void) => {
    if (e.target.files && e.target.files[0]) {
      handler(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 justify-between shadow-sm z-10">
      <div className="flex items-center gap-2">
        <div className="font-bold text-lg text-gray-800 mr-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <FileCode size={20} />
          </div>
          QTI Forge
        </div>
        
        <div className="h-6 w-px bg-gray-300 mx-2" />

        <div className="flex items-center gap-1">
          <label className="cursor-pointer px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors">
            <Upload size={16} />
            <span>Import CSV</span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileChange(e, onImportCsv)} />
          </label>
          
          <label className="cursor-pointer px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors">
            <Upload size={16} />
            <span>Import Word</span>
            <input type="file" accept=".docx" className="hidden" onChange={(e) => handleFileChange(e, onImportWord)} />
          </label>

          <label className="cursor-pointer px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors">
            <Upload size={16} />
            <span>Import QTI</span>
            <input type="file" accept=".zip" className="hidden" onChange={(e) => handleFileChange(e, onImportQti)} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors mr-2 ${
            resetConfirm 
              ? "bg-red-600 text-white hover:bg-red-700" 
              : "text-red-600 hover:bg-red-50"
          }`}
          title="Clear all questions"
        >
          <RotateCcw size={16} />
          {resetConfirm ? "Confirm Clear" : "Reset"}
        </button>

        <div className="h-6 w-px bg-gray-300 mx-2" />

        <div className="flex items-center gap-1">
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet size={16} />
            CSV
          </button>
          
          <button
            onClick={onExportWord}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors"
          >
            <FileText size={16} />
            Word
          </button>

          <div className="relative group">
            <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors shadow-sm">
              <Download size={16} />
              Export QTI
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 hidden group-hover:block">
              <button
                onClick={() => onExportQti('1.2')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                QTI 1.2 Package
              </button>
              <button
                onClick={() => onExportQti('2.2')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                QTI 2.2 Package
              </button>
              <button
                onClick={() => onExportQti('3.0')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                QTI 3.0 Package
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
