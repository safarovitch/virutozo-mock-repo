import { NavLink, Navigate, Route, Routes } from 'react-router';
import type { RootBus } from '@nimbus/mf-contract';
import type { Manifest } from './manifest';
import { RemoteHost } from './RemoteHost';

const AREAS = [
  { name: 'tenants', title: 'Tenants' },
  { name: 'storage', title: 'Storage' },
  { name: 'compute', title: 'Compute' },
] as const;

// TODO(TECH-14): strings move to the message catalogues (MSG-1) on Day 2.
export function App({ manifest, bus }: { manifest: Manifest; bus: RootBus }) {
  return (
    <div className="layout">
      <nav aria-label="Main" className="sidebar">
        <p className="brand">Nimbus Console</p>
        <ul>
          {AREAS.map((a) => (
            <li key={a.name}>
              {/* NavLink sets aria-current="page" on the active item (AC-SHL-2.3). */}
              <NavLink to={`/${a.name}`}>{a.title}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="content">
        <Routes>
          {/* TODO(SPEC-SHL-1): redirect to the user's home area once sign-in exists (Day 3). */}
          <Route path="/" element={<Navigate to="/tenants" replace />} />
          {AREAS.map((a) => (
            <Route
              key={a.name}
              path={`/${a.name}/*`}
              element={<RemoteHost name={a.name} title={a.title} manifest={manifest} bus={bus} />}
            />
          ))}
          <Route path="*" element={<h1>Page not found</h1>} />
        </Routes>
      </main>
    </div>
  );
}
