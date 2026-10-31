// Connection state in the header (WS-4, WS-7, D4-03): always visible, a dot plus text, in a status
// region named "Connection". Reads the sticky `realtime:status` (RT-9), so it is right from the first render.
import { useEffect, useState } from 'react';
import type { BusEvents, RootBus } from '@nimbus/mf-contract';
import { t } from '@nimbus/messages';

type State = BusEvents['realtime:status']['state'];

export function ConnectionIndicator({ bus }: { bus: RootBus }) {
  const [state, setState] = useState<State>('connecting');
  useEffect(() => bus.subscribe('realtime:status', (status) => setState(status.state)), [bus]);
  return <ConnectionIndicatorView state={state} />;
}

export function ConnectionIndicatorView({ state }: { state: State }) {
  return (
    <div role="status" aria-label={t('connections.label')} className={`connection connection--${state}`}>
      <span className="connection__dot" aria-hidden="true" />
      {t(`connections.${state}`)}
    </div>
  );
}
