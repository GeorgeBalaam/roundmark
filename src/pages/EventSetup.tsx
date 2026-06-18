// Event setup wizard. Each step is its own component under ./setup/.
// State is saved to the store on every change, so organisers can leave and
// come back at any point.

import { useParams, useSearchParams } from 'react-router-dom';
import { DashboardShell } from '../components/shells';
import { Button, EventStatusBadge, PageHeader, ProgressStepper } from '../components/ui';
import { PrevIcon, NextIcon, ICON_SM } from '../lib/icons';
import { eventChecklist } from '../lib/events';
import { useEvent } from '../lib/store';
import InfoStep from './setup/InfoStep';
import CourseStep from './setup/CourseStep';
import RegistrationsStep from './setup/RegistrationsStep';
import PlayersStep from './setup/PlayersStep';
import TeamsStep from './setup/TeamsStep';
import SponsorsStep from './setup/SponsorsStep';
import LinksStep from './setup/LinksStep';
import ReviewStep from './setup/ReviewStep';

const STEP_ORDER = ['info', 'course', 'signups', 'players', 'teams', 'sponsors', 'links', 'review'] as const;
type StepKey = (typeof STEP_ORDER)[number];

const STEP_LABELS: Record<StepKey, string> = {
  info: 'Basic info',
  course: 'Course',
  signups: 'Sign-ups',
  players: 'Players',
  teams: 'Teams',
  sponsors: 'Sponsors',
  links: 'QR links',
  review: 'Review & go live',
};

export default function EventSetupPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const [params, setParams] = useSearchParams();

  if (!event) {
    return (
      <DashboardShell>
        <PageHeader title="Event not found" subtitle="It may have been deleted." actions={<Button to="/app">Back to dashboard</Button>} />
      </DashboardShell>
    );
  }

  const rawStep = params.get('step') as StepKey | null;
  const step: StepKey = rawStep && STEP_ORDER.includes(rawStep) ? rawStep : 'info';
  const { items } = eventChecklist(event);
  const doneByKey = Object.fromEntries(items.map((i) => [i.key, i.done]));

  const steps = STEP_ORDER.map((key) => ({
    key,
    label: STEP_LABELS[key],
    done:
      key === 'review'
        ? event.status !== 'draft'
        : key === 'sponsors'
          ? event.sponsors.length > 0
          : key === 'signups'
            ? !!event.registration?.open
            : !!doneByKey[key],
  }));

  function goTo(key: string) {
    setParams({ step: key });
    window.scrollTo({ top: 0 });
  }

  const stepIndex = STEP_ORDER.indexOf(step);
  const next = STEP_ORDER[stepIndex + 1];
  const prev = STEP_ORDER[stepIndex - 1];

  return (
    <DashboardShell>
      <PageHeader
        title={event.name || 'New event'}
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            <EventStatusBadge status={event.status} locked={event.locked} />
            <span>Work through the steps — everything saves as you go.</span>
          </span>
        }
        actions={
          event.status !== 'draft' ? (
            <>
              <Button variant="secondary" to={`/leaderboard/${event.id}`}>
                Leaderboard
              </Button>
              <Button variant="secondary" to={`/app/event/${event.id}/console`}>
                Support console
              </Button>
            </>
          ) : undefined
        }
      />

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <ProgressStepper steps={steps} activeKey={step} onSelect={goTo} />
      </div>

      {step === 'info' && <InfoStep event={event} />}
      {step === 'course' && <CourseStep event={event} />}
      {step === 'signups' && <RegistrationsStep event={event} />}
      {step === 'players' && <PlayersStep event={event} />}
      {step === 'teams' && <TeamsStep event={event} />}
      {step === 'sponsors' && <SponsorsStep event={event} />}
      {step === 'links' && <LinksStep event={event} />}
      {step === 'review' && <ReviewStep event={event} />}

      <div className="row-between" style={{ marginTop: 'var(--space-10)' }}>
        <div>
          {prev && (
            <Button variant="ghost" onClick={() => goTo(prev)}>
              <PrevIcon size={ICON_SM} /> {STEP_LABELS[prev]}
            </Button>
          )}
        </div>
        <div>
          {next && (
            <Button onClick={() => goTo(next)}>
              {STEP_LABELS[next]} <NextIcon size={ICON_SM} />
            </Button>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
