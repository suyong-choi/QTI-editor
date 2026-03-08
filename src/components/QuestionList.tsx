import { Question } from '../lib/types';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';

interface QuestionListProps {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export function QuestionList({ questions, selectedId, onSelect, onAdd, onDelete }: QuestionListProps) {
  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-gray-50 w-80">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="font-semibold text-gray-700">Questions</h2>
        <button
          onClick={onAdd}
          className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          title="Add Question"
        >
          <Plus size={18} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {questions.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 text-sm">
            No questions yet.<br/>Click + to add one.
          </div>
        ) : (
          questions.map((q, index) => (
            <div
              key={q.id}
              onClick={() => onSelect(q.id)}
              className={cn(
                "group flex items-center p-3 rounded-lg cursor-pointer transition-all border",
                selectedId === q.id
                  ? "bg-blue-50 border-blue-200 shadow-sm"
                  : "bg-white border-transparent hover:border-gray-200 hover:shadow-sm"
              )}
            >
              <div className="mr-3 text-gray-400">
                <span className="text-xs font-mono w-5 inline-block text-center">{index + 1}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "text-sm font-medium truncate",
                  selectedId === q.id ? "text-blue-700" : "text-gray-700"
                )}>
                  {q.title || "Untitled Question"}
                </h3>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {q.type === 'multiple-choice' ? 'Multiple Choice' : 
                   q.type === 'multiple-answer' ? 'Multiple Answer' :
                   q.type === 'true-false' ? 'True/False' : 
                   q.type === 'numerical-exact' ? 'Numerical (Exact)' :
                   q.type === 'numerical-margin' ? 'Numerical (Margin)' :
                   q.type === 'short-answer' ? 'Short Answer' :
                   'Essay'}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(q.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
