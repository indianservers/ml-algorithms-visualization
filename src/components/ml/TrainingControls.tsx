import React from 'react';
import { Play, RotateCcw, StopCircle } from 'lucide-react';

interface TrainingControlsProps {
  onTrain: () => void;
  onReset: () => void;
  onStop?: () => void;
  isTraining?: boolean;
  trainLabel?: string;
  disabled?: boolean;
}

export const TrainingControls: React.FC<TrainingControlsProps> = ({
  onTrain, onReset, onStop, isTraining, trainLabel = 'Train Model', disabled
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    <button
      onClick={onTrain}
      disabled={disabled || isTraining}
      title={disabled ? 'Training is unavailable until required inputs are ready' : isTraining ? 'Training is already running' : trainLabel}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
    >
      {isTraining ? (
        <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{' '}Training...</>
      ) : (
        <><Play size={14} /> {trainLabel}</>
      )}
    </button>
    {onStop && isTraining && (
      <button onClick={onStop} className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors">
        <StopCircle size={14} /> Stop
      </button>
    )}
    <button
      onClick={onReset}
      disabled={isTraining}
      title={isTraining ? 'Stop or finish training before resetting' : 'Reset this experiment'}
      className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
    >
      <RotateCcw size={14} /> Reset
    </button>
  </div>
);
