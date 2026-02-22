import Link from 'next/link';

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
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-4 text-center">
          Schedule
        </h1>

        <p className="text-xl text-gray-700 mb-12 text-center">
          Join us for the celebration weekend!
        </p>

        <div className="space-y-6 mb-12">
          {scheduleItems.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-purple-600">
                    {item.event}
                  </h2>
                  <p className="text-gray-600">
                    {item.date} • {item.day}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-purple-600">
                    {item.endTime
                      ? `${item.time} - ${item.endTime}`
                      : item.time}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-gray-700">
                <p className="flex items-center gap-2">
                  <span className="text-purple-500">📍</span>
                  <span className="font-medium">{item.location}</span>
                </p>
                <p className="text-gray-600">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-8 rounded-full shadow-lg transition-all duration-200"
          >
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
