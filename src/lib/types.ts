import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type QuestionType = 
  | 'multiple-choice' 
  | 'multiple-answer' 
  | 'true-false' 
  | 'essay'
  | 'numerical-exact'
  | 'numerical-margin'
  | 'short-answer';

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  title: string;
  type: QuestionType;
  prompt: string;
  options: Option[];
  points: number;
  imageUrl?: string;
  imageName?: string;
  numericalAnswer?: number;
  numericalMargin?: number;
  acceptedAnswers?: string[];
}

export type QtiVersion = '1.2' | '2.2' | '3.0';
