import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import {
  haversineDistanceKm,
  estimatedWalkingMinutes,
  buildWalkingDirectionsUrl,
} from '@/lib/map-utils';
import { HotelRouteMapClient } from '@/components/HotelRouteMapClient';
import { findMainEvent } from '@/lib/db/repositories/events';
import { RSVP_DEADLINE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Hotels & FAQ',
  description:
    'Recommended hotels near the venue and frequently asked questions',
};

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

type Hotel = {
  /** Display name of the hotel. */
  name: string;
  /** Full street address including city, state, and ZIP. */
  address: string;
  /** Pre-geocoded latitude coordinate. */
  lat: number;
  /** Pre-geocoded longitude coordinate. */
  lng: number;
  /** Hotel's official website URL. */
  websiteUrl: string;
};

type FaqItem = {
  /** The question text. */
  question: string;
  /** The answer text. */
  answer: string;
};

export const HOTELS: Hotel[] = [
  {
    name: 'Hygge House Suites',
    address: 'Newburyport, MA 01950',
    lat: 42.80946670508678,
    lng: -70.8695609742041,
    websiteUrl: 'https://www.hyggehouse.com',
  },
  {
    name: 'Cutwater Inn',
    address: 'Newburyport, MA 01950',
    lat: 42.81191777636066,
    lng: -70.87510424536882,
    websiteUrl: 'https://www.cutwaterinn.com',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Is the venue/event space indoors or outdoors?',
    answer:
      'The reception will be held indoors. Weather permitting we will also be reserving a small outdoor space during the cocktail hour.',
  },
  {
    question: 'Will there be transportation provided?',
    answer:
      'No, we will not be providing transportation. But the hotels/inns we recommend are within walking distance of the venue.',
  },
  {
    question: 'What airports should I fly into?',
    answer:
      'The closest major airport is Boston Logan (BOS) which is approximately 50 minutes away by car. Manchester-Boston Regional Airport (MHT) is a similar distance but has fewer direct flights.',
  },
  {
    question: 'When is the deadline for RSVP?',
    answer: `Please RSVP by ${RSVP_DEADLINE.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
  },
  {
    question: 'What is the dress code?',
    answer: 'Cocktail attire is requested.',
  },
  {
    question: 'Is there parking available at the venue?',
    answer:
      'The venue does not have its own parking lot, but there are several public parking options nearby including free street parking, paid lots and a parking garage within walking distance.',
  },
  {
    question: 'Are children welcome?',
    answer:
      "We're only able to accommodate children from our immediate families who are called out on the invitation. We hope you understand!",
  },
  {
    question: 'Can I bring a plus-one?',
    answer:
      "Please refer to your invitation. If a plus-one is allowed, you'll be asked to enter their name at the time of RSVP.",
  },
  {
    question: 'What should I do if I have a dietary restriction?',
    answer:
      'Please note your dietary needs when you RSVP and we will do our best to accommodate you.',
  },
];

/**
 * Public lodging page listing recommended hotels near the venue and FAQ.
 *
 * Venue coordinates are loaded from the main event record in the database so
 * the walking distance and map stay in sync with the admin-managed event data.
 *
 * @returns Server component with hotel listings, route maps, and FAQ items.
 */
export default async function LodgingPage() {
  const mainEvent = await findMainEvent();

  if (
    !mainEvent?.location ||
    mainEvent.locationLat == null ||
    mainEvent.locationLng == null
  ) {
    throw new Error(
      'Main event has not been geocoded. Add location coordinates in the admin panel.',
    );
  }

  const venue = {
    name: mainEvent.location,
    address: mainEvent.location,
    lat: mainEvent.locationLat,
    lng: mainEvent.locationLng,
  };

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-5xl font-bold text-[#9e3f3f] sm:text-6xl`}
        >
          Hotels & FAQ
        </h1>

        <p className="mb-12 text-center text-xl text-[#6a5555]">
          Everything you need to know for the celebration weekend.
        </p>

        {/* Lodging section */}
        <section aria-labelledby="lodging-heading">
          <h2
            id="lodging-heading"
            className={`${marcellus.className} mb-6 text-3xl text-[#9e3f3f]`}
          >
            Recommended Hotels
          </h2>

          <div className="mb-12 flex flex-col gap-6">
            {HOTELS.map((hotel) => {
              const distanceKm = haversineDistanceKm(
                hotel.lat,
                hotel.lng,
                venue.lat,
                venue.lng,
              );
              const walkingMins = estimatedWalkingMinutes(distanceKm);
              const directionsUrl = buildWalkingDirectionsUrl(
                hotel.address,
                venue.address,
              );

              return (
                <div
                  key={hotel.name}
                  className="overflow-hidden rounded-xl border border-[#f3dedb] bg-white shadow-sm"
                >
                  <div className="lg:grid lg:grid-cols-[1fr_360px]">
                    {/* Hotel details */}
                    <div className="p-6">
                      <h3
                        className={`${marcellus.className} mb-2 text-2xl text-[#9e3f3f]`}
                      >
                        {hotel.name}
                      </h3>

                      <p className="mb-1 text-[#6a5555]">{hotel.address}</p>

                      <p className="mb-4 text-sm text-[#6a5555]">
                        ~{walkingMins}-minute walk to the venue
                      </p>

                      <div className="flex flex-wrap gap-4">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#9e3f3f] underline transition-colors hover:text-[#b76565]"
                        >
                          Get Walking Directions ↗
                        </a>

                        <a
                          href={hotel.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#9e3f3f] underline transition-colors hover:text-[#b76565]"
                        >
                          Hotel Website
                        </a>
                      </div>
                    </div>

                    {/* Map slot */}
                    <div className="border-t border-[#f3dedb] lg:border-t-0 lg:border-l">
                      <HotelRouteMapClient
                        hotelLat={hotel.lat}
                        hotelLng={hotel.lng}
                        hotelName={hotel.name}
                        venueLat={venue.lat}
                        venueLng={venue.lng}
                        venueName={venue.name}
                        height="280px"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ section */}
        <section aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className={`${marcellus.className} mb-6 text-3xl text-[#9e3f3f]`}
          >
            Frequently Asked Questions
          </h2>

          <div className="flex flex-col gap-4">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-[#f3dedb] bg-white p-6 shadow-sm"
              >
                <p
                  className={`${marcellus.className} mb-2 text-lg text-[#9e3f3f]`}
                >
                  {item.question}
                </p>

                <p className="text-[#6a5555]">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
