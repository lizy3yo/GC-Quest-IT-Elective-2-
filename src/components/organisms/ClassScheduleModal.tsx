import { useMemo } from 'react';
import { IClassInfo } from '@/interfaces';

interface ClassScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: IClassInfo[];
}

export default function ClassScheduleModal({ isOpen, onClose, classes }: ClassScheduleModalProps) {
  const weeklySchedule = useMemo(() => {
    const daysOrder = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const map: Record<string, Array<{ name: string; time: string }>> = {};
    daysOrder.forEach((d) => (map[d] = []));

    for (const cls of classes) {
      if (!cls.day || !cls.time) continue;

      for (const day of cls.day) {
        const fullDay = daysOrder.find(d => d.toLowerCase().startsWith(day.toLowerCase()));
        if (fullDay) {
          map[fullDay].push({
            name: cls.name,
            time: `${cls.time}${cls.room ? ` · ${cls.room}` : ''}`
          });
        }
      }
    }
    return { daysOrder, map };
  }, [classes]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[1400px] mx-4 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-2xl font-semibold text-gray-900">Class Schedule</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[640px] overflow-y-auto px-2 pb-2">
          {weeklySchedule.daysOrder.map((day, dayIdx) => (
            <div key={day} className="flex flex-col bg-transparent border border-gray-100 rounded-lg p-3">
              <div className={`rounded-t-md text-white text-sm font-semibold text-center py-2 ${[
                'bg-blue-500',
                'bg-purple-500',
                'bg-emerald-500',
                'bg-orange-500',
                'bg-pink-500',
                'bg-lime-500',
                'bg-indigo-500'
              ][dayIdx % 7]}`}>{day}</div>

              <div className="flex-1 overflow-y-auto">
                {weeklySchedule.map[day].length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No classes</p>
                ) : (
                  <div className="space-y-4">
                    {weeklySchedule.map[day].map((item, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-100 rounded-md p-3 shadow-sm">
                        <div className="font-semibold text-sm text-gray-900 leading-snug mb-1">{item.name}</div>
                        <div className="text-xs text-gray-600">{item.time}</div>
                        {item.time.includes('·') && (
                          <div className="text-xs text-gray-500 mt-2">{item.time.split('·').slice(-1)[0].trim()}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
