import React, { useState, useEffect } from 'react';
import { Question, QtiVersion } from './lib/types';
import { manualQuestions } from './lib/manual_data';
import { QuestionList } from './components/QuestionList';
import { QuestionEditor } from './components/QuestionEditor';
import { Toolbar } from './components/Toolbar';
import { parseCsv, parseWord, parseQti } from './lib/import';
import { exportCsv, exportWord } from './lib/export';
import { exportQtiPackage } from './lib/qti';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [questions, setQuestions] = useState<Question[]>(manualQuestions);
  const [selectedId, setSelectedId] = useState<string | null>(manualQuestions.length > 0 ? manualQuestions[0].id : null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatus({ message, type });
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: uuidv4(),
      title: 'New Question',
      type: 'multiple-choice',
      prompt: '',
      options: [
        { id: uuidv4(), text: 'Option 1', isCorrect: false },
        { id: uuidv4(), text: 'Option 2', isCorrect: false }
      ],
      points: 1
    };
    setQuestions([...questions, newQuestion]);
    setSelectedId(newQuestion.id);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleUpdateQuestion = (updated: Question) => {
    setQuestions(questions.map(q => q.id === updated.id ? updated : q));
  };

  const handleImportCsv = async (file: File) => {
    try {
      const imported = await parseCsv(file);
      setQuestions(prev => [...prev, ...imported]);
      showStatus(`Imported ${imported.length} questions from CSV`, 'success');
    } catch (error) {
      console.error('Failed to import CSV:', error);
      showStatus('Failed to import CSV file', 'error');
    }
  };

  const handleImportWord = async (file: File) => {
    try {
      const imported = await parseWord(file);
      setQuestions(prev => [...prev, ...imported]);
      showStatus(`Imported ${imported.length} questions from Word`, 'success');
    } catch (error) {
      console.error('Failed to import Word file:', error);
      showStatus('Failed to import Word file', 'error');
    }
  };

  const handleImportQti = async (file: File) => {
    try {
      const imported = await parseQti(file);
      setQuestions(prev => [...prev, ...imported]);
      showStatus(`Imported ${imported.length} questions from QTI Package`, 'success');
    } catch (error) {
      console.error('Failed to import QTI package:', error);
      showStatus('Failed to import QTI package', 'error');
    }
  };

  const handleExportCsv = () => {
    exportCsv(questions);
    showStatus('Exported to CSV', 'success');
  };

  const handleExportWord = () => {
    exportWord(questions);
    showStatus('Exported to Word', 'success');
  };

  const handleExportQti = (version: QtiVersion) => {
    exportQtiPackage(questions, version);
    showStatus(`Exported QTI ${version} Package`, 'success');
  };

  const handleReset = () => {
    if (resetConfirm) {
      setQuestions([]);
      setSelectedId(null);
      setResetConfirm(false);
      showStatus('All questions cleared', 'success');
    } else {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
    }
  };

  const selectedQuestion = questions.find(q => q.id === selectedId) || null;

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden relative">
      {status && (
        <div className={`absolute top-16 right-4 z-50 px-4 py-2 rounded shadow-lg text-white ${status.type === 'success' ? 'bg-green-600' : 'bg-red-600'} transition-opacity duration-300`}>
          {status.message}
        </div>
      )}

      <Toolbar
        onImportCsv={handleImportCsv}
        onImportWord={handleImportWord}
        onImportQti={handleImportQti}
        onExportCsv={handleExportCsv}
        onExportWord={handleExportWord}
        onExportQti={handleExportQti}
        onReset={handleReset}
        resetConfirm={resetConfirm}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <QuestionList
          questions={questions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAddQuestion}
          onDelete={handleDeleteQuestion}
        />
        
        <main className="flex-1 overflow-hidden relative bg-white">
          {selectedQuestion ? (
            <QuestionEditor
              question={selectedQuestion}
              onChange={handleUpdateQuestion}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-lg font-medium">No Question Selected</p>
                <p className="text-sm">Select a question from the list or create a new one.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
