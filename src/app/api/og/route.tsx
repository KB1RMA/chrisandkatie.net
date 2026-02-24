import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * Generates a dynamic Open Graph image for social media sharing.
 * Displays "Chris & Katie" in script font with heart decorations over a background.
 *
 * @returns ImageResponse with the generated OG image.
 */
export async function GET() {
  try {
    // Calculate days and hours until wedding
    const weddingDate = new Date('2026-09-12T16:00:00');
    const now = new Date();
    const difference = weddingDate.getTime() - now.getTime();
    const daysUntil = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hoursUntil = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutesUntil = Math.floor((difference / 1000 / 60) % 60);
    const isWeddingDay = daysUntil <= 0;

    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
        }}
      >
        {/* Semi-transparent overlay for text readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 247, 244, 0.5)',
            display: 'flex',
          }}
        />

        {/* Content container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Hearts with initials - Left heart (C) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#d81b60',
                marginRight: '20px',
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              C
            </div>

            {/* Ampersand */}
            <div
              style={{
                fontSize: '60px',
                fontWeight: 'bold',
                color: '#ffd700',
                marginLeft: '10px',
                marginRight: '10px',
              }}
            >
              &
            </div>

            {/* Right heart (K) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#c2185b',
                marginLeft: '20px',
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              K
            </div>
          </div>

          {/* Main text */}
          <div
            style={{
              fontSize: '120px',
              fontWeight: 'normal',
              fontFamily: '"Brush Script MT", cursive',
              color: '#9e3f3f',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)',
              letterSpacing: '0.05em',
              display: 'flex',
            }}
          >
            Chris & Katie
          </div>

          {/* Countdown */}
          <div
            style={{
              marginTop: '30px',
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#6a5555',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)',
              display: isWeddingDay ? 'none' : 'flex',
            }}
          >
            {daysUntil}d {hoursUntil}h {minutesUntil}m until the celebration
          </div>

          {/* Ring decoration */}
          <div
            style={{
              marginTop: '30px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: '4px solid #ffd700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ffd700',
                display: 'flex',
              }}
            />
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error('Error generating OG image:', error);

    return new Response('Failed to generate image', { status: 500 });
  }
}
