import { Button } from '@/components/Button';

/**
 * Schedule item for the celebration events.
 */
interface ScheduleItem {
  date: string;
  day: string;
  time: string;
  endTime?: string;
  event: string;
  location: string;
  description: string;
}

const scheduleItems: ScheduleItem[] = [
  {
    date: 'September 10',
    day: 'Thursday',
    time: '6:00 PM',
    event: 'Barbecue',
    location: "Dad's House",
    description: 'Casual outdoor gathering with appetizers and refreshments.',
  },
  {
    date: 'September 11',
    day: 'Friday',
    time: '6:00 PM',
    event: 'Barbecue',
    location: "Chris & Katie's House",
    description:
      'Final gathering with close friends and family before the celebration weekend.',
  },
  {
    date: 'September 12',
    day: 'Saturday',
    time: '4:00 PM',
    event: 'Cocktail Hour',
    location: 'The Venue',
    description:
      'Pre-celebration gathering with drinks, appetizers, and mingling.',
  },
  {
    date: 'September 12',
    day: 'Saturday',
    time: '5:00 PM',
    endTime: '10:00 PM',
    event: 'Marriage Celebration',
    location: 'The Venue',
    description:
      'Join us for dinner, dancing, and a celebration of our marriage!',
  },
];

/**
 * Schedule page displaying all celebration events.
 */
export default function SchedulePage() {
  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-5xl sm:text-6xl font-bold text-[#9e3f3f] mb-4 text-center">
          Schedule
        </h1>

        <p className="text-xl text-[#6a5555] mb-12 text-center">
          Join us for the celebration weekend!
        </p>

        <div className="space-y-6 mb-12">
          {scheduleItems.map((item, index) => (
            <div
              key={index}
              className="bg-[#fffdfb] rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#9e3f3f]">
                    {item.event}
                  </h2>
                  <p className="text-[#7a6666]">
                    {item.date} • {item.day}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[#9e3f3f]">
                    {item.endTime
                      ? `${item.time} - ${item.endTime}`
                      : item.time}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-[#6a5555]">
                <p className="flex items-center gap-2">
                  <span className="text-[#b76565]">📍</span>
                  <span className="font-medium">{item.location}</span>
                </p>
                <p className="text-[#7a6666]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button href="/">Back Home</Button>
        </div>
      </div>
    </div>
  );
}
