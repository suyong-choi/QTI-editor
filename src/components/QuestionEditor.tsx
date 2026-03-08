import React from 'react';
import { Question, Option, QuestionType } from '../lib/types';
import { Trash2, Plus, CheckCircle2, Circle, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface QuestionEditorProps {
  question: Question | null;
  onChange: (updated: Question) => void;
}

export function QuestionEditor({ question, onChange }: QuestionEditorProps) {
  if (!question) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50/50">
        Select a question to edit
      </div>
    );
  }

  const updateField = (field: keyof Question, value: any) => {
    onChange({ ...question, [field]: value });
  };

  const addOption = () => {
    const newOption: Option = {
      id: uuidv4(),
      text: `Option ${question.options.length + 1}`,
      isCorrect: false
    };
    onChange({
      ...question,
      options: [...question.options, newOption]
    });
  };

  const removeOption = (id: string) => {
    onChange({
      ...question,
      options: question.options.filter(o => o.id !== id)
    });
  };

  const updateOption = (id: string, field: keyof Option, value: any) => {
    onChange({
      ...question,
      options: question.options.map(o => 
        o.id === id ? { ...o, [field]: value } : o
      )
    });
  };

  const setCorrectOption = (id: string) => {
    if (question.type === 'multiple-answer') {
      // Toggle for multiple answer
      onChange({
        ...question,
        options: question.options.map(o => 
          o.id === id ? { ...o, isCorrect: !o.isCorrect } : o
        )
      });
    } else {
      // Single choice behavior
      onChange({
        ...question,
        options: question.options.map(o => ({
          ...o,
          isCorrect: o.id === id
        }))
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({
          ...question,
          imageUrl: reader.result as string,
          imageName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    onChange({
      ...question,
      imageUrl: undefined,
      imageName: undefined
    });
  };

  const addAcceptedAnswer = () => {
    onChange({
      ...question,
      acceptedAnswers: [...(question.acceptedAnswers || []), '']
    });
  };

  const updateAcceptedAnswer = (index: number, value: string) => {
    const newAnswers = [...(question.acceptedAnswers || [])];
    newAnswers[index] = value;
    onChange({
      ...question,
      acceptedAnswers: newAnswers
    });
  };

  const removeAcceptedAnswer = (index: number) => {
    const newAnswers = [...(question.acceptedAnswers || [])];
    newAnswers.splice(index, 1);
    onChange({
      ...question,
      acceptedAnswers: newAnswers
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-8 space-y-8">
        
        {/* Header */}
        <div className="space-y-4">
          <input
            type="text"
            value={question.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="text-2xl font-bold w-full border-none focus:ring-0 p-0 placeholder-gray-300"
            placeholder="Question Title"
          />
          
          <div className="flex gap-4 flex-wrap">
            <select
              value={question.type}
              onChange={(e) => {
                const newType = e.target.value as QuestionType;
                let newOptions = question.options;
                
                if (newType === 'true-false') {
                  newOptions = [
                    { id: uuidv4(), text: 'True', isCorrect: true },
                    { id: uuidv4(), text: 'False', isCorrect: false }
                  ];
                } else if (['essay', 'numerical-exact', 'numerical-margin', 'short-answer'].includes(newType)) {
                  newOptions = [];
                } else if (['multiple-choice', 'multiple-answer'].includes(newType) && !['multiple-choice', 'multiple-answer'].includes(question.type)) {
                  // Restore default options if coming from non-choice type
                  newOptions = [
                    { id: uuidv4(), text: 'Option 1', isCorrect: false },
                    { id: uuidv4(), text: 'Option 2', isCorrect: false }
                  ];
                }
                
                onChange({ 
                  ...question, 
                  type: newType,
                  options: newOptions,
                  // Initialize new fields if needed
                  acceptedAnswers: newType === 'short-answer' ? [''] : question.acceptedAnswers
                });
              }}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            >
              <option value="multiple-choice">Multiple Choice</option>
              <option value="multiple-answer">Multiple Answer</option>
              <option value="true-false">True / False</option>
              <option value="short-answer">Short Answer</option>
              <option value="numerical-exact">Numerical (Exact)</option>
              <option value="numerical-margin">Numerical (Margin)</option>
              <option value="essay">Essay</option>
            </select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Points:</span>
              <input
                type="number"
                min="0"
                value={question.points}
                onChange={(e) => updateField('points', parseInt(e.target.value) || 0)}
                className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Question Prompt</label>
          <textarea
            value={question.prompt}
            onChange={(e) => updateField('prompt', e.target.value)}
            rows={4}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border resize-y min-h-[100px]"
            placeholder="Enter the question text here..."
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Question Figure (Optional)</label>
          {question.imageUrl ? (
            <div className="relative inline-block border rounded-lg overflow-hidden group">
              <img src={question.imageUrl} alt="Question Figure" className="max-h-64 object-contain bg-gray-50" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload image</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          )}
        </div>

        {/* Options for Choice Types */}
        {['multiple-choice', 'multiple-answer', 'true-false'].includes(question.type) && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                {question.type === 'multiple-answer' ? 'Answer Options (Select all correct)' : 'Answer Options (Select correct)'}
              </label>
              {['multiple-choice', 'multiple-answer'].includes(question.type) && (
                <button
                  onClick={addOption}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus size={16} /> Add Option
                </button>
              )}
            </div>

            <div className="space-y-3">
              {question.options.map((option) => (
                <div key={option.id} className="flex items-center gap-3 group">
                  <button
                    onClick={() => setCorrectOption(option.id)}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      option.isCorrect ? "text-green-600 bg-green-50" : "text-gray-300 hover:text-gray-400"
                    )}
                    title={option.isCorrect ? "Correct answer" : "Mark as correct"}
                  >
                    {option.isCorrect ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                    readOnly={question.type === 'true-false'}
                    className={cn(
                      "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                      question.type === 'true-false' && "bg-gray-50 text-gray-500"
                    )}
                    placeholder="Option text"
                  />

                  {['multiple-choice', 'multiple-answer'].includes(question.type) && (
                    <button
                      onClick={() => removeOption(option.id)}
                      className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Numerical Exact */}
        {question.type === 'numerical-exact' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
            <input
              type="number"
              value={question.numericalAnswer ?? ''}
              onChange={(e) => updateField('numericalAnswer', parseFloat(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="Enter exact number"
            />
          </div>
        )}

        {/* Numerical Margin */}
        {question.type === 'numerical-margin' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
              <input
                type="number"
                value={question.numericalAnswer ?? ''}
                onChange={(e) => updateField('numericalAnswer', parseFloat(e.target.value))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                placeholder="Enter target number"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Margin of Error (+/-)</label>
              <input
                type="number"
                value={question.numericalMargin ?? ''}
                onChange={(e) => updateField('numericalMargin', parseFloat(e.target.value))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                placeholder="Allowed deviation"
              />
            </div>
          </div>
        )}

        {/* Short Answer */}
        {question.type === 'short-answer' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Accepted Answers (Case Insensitive)</label>
              <button
                onClick={addAcceptedAnswer}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus size={16} /> Add Answer
              </button>
            </div>
            <div className="space-y-2">
              {(question.acceptedAnswers || []).map((answer, index) => (
                <div key={index} className="flex items-center gap-2 group">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => updateAcceptedAnswer(index, e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="Enter accepted text"
                  />
                  <button
                    onClick={() => removeAcceptedAnswer(index)}
                    className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {(question.acceptedAnswers?.length === 0) && (
                <p className="text-sm text-gray-400 italic">No accepted answers defined.</p>
              )}
            </div>
          </div>
        )}

        {question.type === 'essay' && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500 italic">
            Essay questions require manual grading. No automated answer key is available.
          </div>
        )}

      </div>
    </div>
  );
}
