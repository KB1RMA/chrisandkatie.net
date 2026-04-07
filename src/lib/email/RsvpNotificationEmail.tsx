/**
 * React Email component for RSVP notification emails.
 *
 * Renders a styled HTML email containing all RSVP submission details
 * for delivery to the site owner via the notification queue.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { RsvpNotificationPayload } from './notification';

/**
 * Renders the RSVP notification email body.
 *
 * @param payload - The RSVP notification data to render.
 * @returns A React element representing the full HTML email.
 */
export function RsvpNotificationEmail(
  payload: RsvpNotificationPayload,
): React.ReactElement {
  const {
    isUpdate,
    guestName,
    eventName,
    attendanceStatus,
    numberOfAttending,
    specialRequests,
    attendees,
  } = payload;

  const headingLabel = isUpdate ? '[Updated RSVP]' : '[New RSVP]';
  const previewText = `${headingLabel} ${guestName} — ${eventName}`;

  const attendanceLabel =
    attendanceStatus === 'attending' ? 'Attending' : 'Not attending';

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            {headingLabel} {guestName}
          </Heading>
          <Text style={styles.meta}>Event: {eventName}</Text>

          <Hr style={styles.hr} />

          <Section>
            <Text style={styles.label}>Attendance</Text>
            <Text style={styles.value}>{attendanceLabel}</Text>
          </Section>

          <Section>
            <Text style={styles.label}>Number attending</Text>
            <Text style={styles.value}>{numberOfAttending}</Text>
          </Section>

          <Section>
            <Text style={styles.label}>Special requests</Text>
            <Text style={styles.value}>{specialRequests ?? 'None'}</Text>
          </Section>

          {attendees.length > 0 && (
            <Section>
              <Text style={styles.label}>Attendees</Text>
              {attendees.map((attendee, index) => (
                <Container key={index} style={styles.attendeeBlock}>
                  <Text style={styles.attendeeName}>{attendee.name}</Text>
                  <Text style={styles.attendeeDetail}>
                    Meal: {attendee.mealOption ?? 'None'}
                  </Text>
                  <Text style={styles.attendeeDetail}>
                    Dietary restrictions:{' '}
                    {attendee.dietaryRestrictions ?? 'None'}
                  </Text>
                </Container>
              ))}
            </Section>
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>chrisandkatie.net</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#ffffff',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: '#1a1a1a',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  heading: {
    fontFamily: 'Georgia, serif',
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '4px',
  },
  meta: {
    fontSize: '14px',
    color: '#555555',
    marginTop: '0',
  },
  hr: {
    borderColor: '#e0e0e0',
    margin: '20px 0',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    color: '#888888',
    marginBottom: '2px',
  },
  value: {
    fontSize: '15px',
    color: '#1a1a1a',
    marginTop: '0',
    marginBottom: '16px',
  },
  attendeeBlock: {
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '8px',
  },
  attendeeName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '0 0 4px 0',
  },
  attendeeDetail: {
    fontSize: '13px',
    color: '#555555',
    margin: '0 0 2px 0',
  },
  footer: {
    fontSize: '12px',
    color: '#aaaaaa',
    textAlign: 'center' as const,
  },
} as const;
