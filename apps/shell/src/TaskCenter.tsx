// Task center (SPEC-TSK-1): a header button with the running count (D4-01) that opens a disclosure panel
// (D4-02) with running tasks first, then the last 24 h. Owned by the shell; areas only publish task:started.
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ApiError, messageFor } from '@nimbus/api-client';
import type { Task, TaskStatus } from '@nimbus/api-client/model';
import { canOpen } from '@nimbus/auth';
import { formatRelativeTime } from '@nimbus/format';
import type { RootBus, SessionSnapshot } from '@nimbus/mf-contract';
import { t, tp } from '@nimbus/messages';
import { EmptyState, ErrorState, ProgressBar, Skeleton, StatusBadge, type StatusTone } from '@nimbus/ui-kit';
import { groupTasks, useTaskCenter } from './tasks';

const TONE: Record<TaskStatus, StatusTone> = { queued: 'info', running: 'warning', succeeded: 'success', failed: 'danger' };

/** Container: the live query (shell cache, D4-09) feeding the view. */
export function TaskCenter({ bus, session }: { bus: RootBus; session: SessionSnapshot }) {
  const query = useTaskCenter(bus);
  return (
    <TaskCenterView
      session={session}
      tasks={query.data?.items}
      error={query.isError ? query.error : undefined}
      onRetry={() => void query.refetch()}
    />
  );
}

export interface TaskCenterViewProps {
  session: SessionSnapshot;
  /** `undefined` while the first load is pending. */
  tasks: readonly Task[] | undefined;
  error?: unknown;
  onRetry?: () => void;
  defaultOpen?: boolean;
  now?: number;
}

export function TaskCenterView({ session, tasks, error, onRetry, defaultOpen = false, now = Date.now() }: TaskCenterViewProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const groups = groupTasks(tasks ?? [], now);
  const count = groups.activeCount;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      ref={root}
      className="task-center"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) close();
      }}
    >
      <button
        ref={button}
        type="button"
        className="nui-button nui-button--ghost"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {/* Name from content, so it contains the visible text (WCAG 2.5.3). One hidden text node: Chromium
            would insert a space before a separate absolutely positioned suffix. */}
        {count > 0 ? (
          <>
            <span aria-hidden="true">{t('tasks.title')}</span>
            <span className="task-center__badge" aria-hidden="true">
              {count}
            </span>
            <span className="nui-visually-hidden">{`${t('tasks.title')}, ${tp('shell.runningTasks', count)}`}</span>
          </>
        ) : (
          t('tasks.title')
        )}
      </button>
      <div id={panelId} className="task-center__panel" hidden={!open}>
        {error !== undefined ? (
          <ErrorState message={messageFor(error instanceof ApiError ? error.problem : { code: 'INTERNAL' })} onRetry={onRetry} />
        ) : tasks === undefined ? (
          <Skeleton lines={4} />
        ) : groups.running.length + groups.recent.length === 0 ? (
          <EmptyState title={t('tasks.empty')} />
        ) : (
          <>
            {groups.running.length > 0 && (
              <TaskList heading={t('tasks.running')} tasks={groups.running} session={session} now={now} onNavigate={() => setOpen(false)} />
            )}
            {groups.recent.length > 0 && (
              <TaskList heading={t('tasks.recent')} tasks={groups.recent} session={session} now={now} onNavigate={() => setOpen(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TaskList(props: { heading: string; tasks: Task[]; session: SessionSnapshot; now: number; onNavigate: () => void }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="task-center__heading">
        {props.heading}
      </h2>
      <ul className="task-center__list">
        {props.tasks.map((task) => (
          <TaskItem key={task.id} task={task} session={props.session} now={props.now} onNavigate={props.onNavigate} />
        ))}
      </ul>
    </section>
  );
}

function TaskItem({ task, session, now, onNavigate }: { task: Task; session: SessionSnapshot; now: number; onNavigate: () => void }) {
  const kind = t(`taskKind.${task.kind}`);
  const href = canOpen(task, session); // null → plain text (AC-TSK-1.6)
  const time = task.finishedAt ?? task.createdAt;
  return (
    <li className="task-center__item">
      <div className="task-center__row">
        <span className="task-center__kind">{kind}</span>
        <StatusBadge tone={TONE[task.status]} label={t(`status.task.${task.status}`)} />
      </div>
      <div className="task-center__row">
        <span className="task-center__resource">{task.resource.name}</span>
        <time dateTime={time}>{formatRelativeTime(time, new Date(now))}</time>
      </div>
      {(task.status === 'running' || task.status === 'queued') && (
        <ProgressBar label={t('tasks.progressLabel', { kind, name: task.resource.name })} value={task.progress / 100} />
      )}
      {task.status === 'failed' && task.error && <p className="task-center__error">{messageFor(task.error)}</p>}
      {href && (
        <Link to={href} onClick={onNavigate} aria-label={`${t('tasks.viewResource')}: ${task.resource.name}`}>
          {t('tasks.viewResource')}
        </Link>
      )}
    </li>
  );
}
