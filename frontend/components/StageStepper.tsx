import type { ApplicationStage } from '@/lib/types';

interface StageStepperProps {
  currentStage: ApplicationStage;
}

const stages: ApplicationStage[] = ['开户预约', '资料审核', '账户启用'];

export default function StageStepper({ currentStage }: StageStepperProps) {
  const currentIndex = stages.indexOf(currentStage);

  return (
    <div className="flex items-center justify-center w-full">
      {stages.map((stage, index) => {
        let statusClass = 'stage-pending';
        if (index < currentIndex) {
          statusClass = 'stage-completed';
        } else if (index === currentIndex) {
          statusClass = 'stage-active';
        }

        return (
          <div key={stage} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${statusClass}`}
              >
                {index + 1}
              </div>
              <span className="mt-2 text-sm font-medium">{stage}</span>
            </div>
            {index < stages.length - 1 && (
              <div
                className={`w-16 h-1 mx-2 rounded ${
                  index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
