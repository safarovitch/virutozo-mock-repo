// In-memory database and deterministic seed (specs/mock-data.md §1–§7, Day 2 decisions D2-05, D2-06).
import type { Bucket, Plan, Role, Task, Tenant, TenantStatus, Vm, VitalRecord, VmStatus } from '@nimbus/api-client/model';
import { createRng, hash, int, pick, shuffle, type Rng } from './rng';

export const GIB = 1024 ** 3;
export const TIB = 1024 * GIB;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  resellerId: string | null;
}

export const USERS: Record<Role, DemoUser> = {
  provider_admin: { id: 'u_provider', name: 'Alex Provider', email: 'alex@nimbus.test', role: 'provider_admin', tenantId: null, resellerId: null },
  reseller_admin: { id: 'u_reseller', name: 'Rita Reseller', email: 'rita@northwind.test', role: 'reseller_admin', tenantId: null, resellerId: 'r_northwind' },
  tenant_admin: { id: 'u_tadmin', name: 'Tom Admin', email: 'tom@acme.test', role: 'tenant_admin', tenantId: 't_acme', resellerId: null },
  tenant_viewer: { id: 'u_tviewer', name: 'Vera Viewer', email: 'vera@acme.test', role: 'tenant_viewer', tenantId: 't_acme', resellerId: null },
};

const money = (amountMicros: number) => ({ amountMicros, currency: 'EUR' });
export const PLANS: Plan[] = [
  { id: 'p_starter', name: 'Starter', maxStorageQuotaBytes: 100 * GIB, maxVmQuota: 10, defaultStorageQuotaBytes: 50 * GIB, defaultVmQuota: 5, pricePerGiBMonth: money(40_000), pricePerVcpuMonth: money(6_000_000) },
  { id: 'p_business', name: 'Business', maxStorageQuotaBytes: TIB, maxVmQuota: 50, defaultStorageQuotaBytes: 250 * GIB, defaultVmQuota: 20, pricePerGiBMonth: money(35_000), pricePerVcpuMonth: money(5_500_000) },
  { id: 'p_enterprise', name: 'Enterprise', maxStorageQuotaBytes: 10 * TIB, maxVmQuota: 200, defaultStorageQuotaBytes: 2 * TIB, defaultVmQuota: 100, pricePerGiBMonth: money(30_000), pricePerVcpuMonth: money(5_000_000) },
  { id: 'p_unlimited', name: 'Unlimited', maxStorageQuotaBytes: 100 * TIB, maxVmQuota: 500, defaultStorageQuotaBytes: 10 * TIB, defaultVmQuota: 250, pricePerGiBMonth: money(25_000), pricePerVcpuMonth: money(4_500_000) },
];
export const planById = (id: string) => PLANS.find((p) => p.id === id);

export const RESELLERS = [
  { id: 'r_northwind', name: 'Northwind Hosting', owned: 1200 },
  { id: 'r_bluepeak', name: 'BluePeak Cloud', owned: 800 },
  { id: 'r_orbit', name: 'Orbit Systems', owned: 500 },
];

const ADJECTIVES = ['brave', 'calm', 'clever', 'eager', 'fancy', 'gentle', 'happy', 'jolly', 'kind', 'lively', 'nice', 'proud', 'quick', 'silly', 'swift', 'witty', 'bold', 'bright', 'cosy', 'daring', 'fresh', 'grand', 'keen', 'lucky', 'merry', 'noble', 'quiet', 'sunny', 'tidy', 'vivid'];
const NOUNS = ['otter', 'falcon', 'maple', 'river', 'comet', 'harbor', 'meadow', 'pine', 'summit', 'canyon', 'badger', 'lynx', 'orchid', 'cedar', 'glacier', 'heron', 'island', 'jaguar', 'koala', 'lagoon', 'marten', 'nebula', 'oasis', 'panda', 'quartz', 'raven', 'sparrow', 'tundra', 'willow', 'zephyr'];
const IMAGES = ['ubuntu-24.04', 'debian-13', 'rocky-10', 'windows-2025'];
const VM_NAMES = [
  ...Array.from({ length: 12 }, (_, i) => `web-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `db-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 20 }, (_, i) => `worker-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `cache-${String(i + 1).padStart(2, '0')}`),
];
const BUCKET_WORDS = ['assets', 'backups', 'logs', 'media', 'reports', 'exports', 'uploads', 'archive', 'static', 'data', 'models', 'invoices'];
const ACME_BUCKETS: Array<[string, number, number]> = [
  // name, size GiB, objects. Sum 205 GiB = 82% of 250 GiB (D2-05). acme-scratch is empty; acme-backups holds objects.
  ['acme-assets', 1, 1200], ['acme-backups', 80, 5400], ['acme-logs-2026', 9, 88000], ['acme-scratch', 0, 0],
  ['acme-media', 15, 3100], ['acme-reports', 4, 640], ['acme-exports', 6, 210], ['acme-uploads', 5, 9300],
  ['acme-archive', 25, 1500], ['acme-static', 3, 450], ['acme-data-lake', 40, 22000], ['acme-ml-models', 12, 37],
  ['acme-invoices', 2, 5100], ['acme-dev', 1, 75], ['acme-staging', 2, 160],
];

export class Db {
  readonly seedTime: number;
  readonly tenants = new Map<string, Tenant>();
  readonly tenantOrder: string[] = [];
  readonly buckets = new Map<string, Bucket>();
  /** Tenants whose buckets exist in `buckets` (acme from the seed, others once listed, D8-04). */
  private readonly bucketTenants = new Set<string>(['t_acme']);
  readonly tasks = new Map<string, Task>();
  readonly vitals: Array<VitalRecord & { receivedAt: number }> = [];
  private readonly vms = new Map<string, Vm>();
  private readonly vmIdsByTenant = new Map<string, string[]>();

  constructor(private readonly seed: number, now = Date.now()) {
    this.seedTime = now;
    const rng = createRng(seed);
    this.seedTenants(rng);
    this.seedAcmeVms(rng);
    this.seedAcmeBuckets();
    this.seedTasks();
  }

  // ── Tenants ──
  private seedTenants(rng: Rng): void {
    const total = 10_000;
    const statuses = shuffle(rng, [
      ...Array<TenantStatus>(8500 - 2).fill('active'), ...Array<TenantStatus>(800).fill('suspended'),
      ...Array<TenantStatus>(200).fill('provisioning'), ...Array<TenantStatus>(500).fill('error'),
    ]);
    const plans = shuffle(rng, [
      ...Array(5000 - 1).fill('p_starter'), ...Array(3000 - 1).fill('p_business'),
      ...Array(1500).fill('p_enterprise'), ...Array(500).fill('p_unlimited'),
    ] as string[]);
    const resellers = shuffle(rng, [
      ...Array(1200 - 1).fill('r_northwind'), ...Array(800).fill('r_bluepeak'), ...Array(500).fill('r_orbit'),
      ...Array(total - 2500 - 1).fill(null),
    ] as Array<string | null>);
    const usedIds = new Set<string>();
    const newId = () => {
      for (;;) {
        const id = `t_${Array.from({ length: 5 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[int(rng, 0, 35)]).join('')}`;
        if (!usedIds.has(id)) return usedIds.add(id), id;
      }
    };

    this.addTenant({
      id: 't_acme', name: 'acme', displayName: 'Acme Corporation', status: 'active', planId: 'p_business',
      resellerId: 'r_northwind', adminEmail: 'tom@acme.test', createdAt: iso(this.seedTime - 700 * DAY),
      storageUsedBytes: 205 * GIB, storageQuotaBytes: 250 * GIB, vmCount: 40, vmQuota: 50,
    });
    usedIds.add('t_acme');
    this.addTenant(this.generatedTenant(rng, newId(), 'taken-name', 'active', 'p_starter', null));
    for (let i = 0; i < total - 2; i++) {
      const name = `${pick(rng, ADJECTIVES)}-${pick(rng, NOUNS)}-${i + 1}`;
      this.addTenant(this.generatedTenant(rng, newId(), name, statuses[i] as TenantStatus, plans[i] as string, resellers[i] ?? null));
    }
  }

  private generatedTenant(rng: Rng, id: string, name: string, status: TenantStatus, planId: string, resellerId: string | null): Tenant {
    const plan = planById(planId) as Plan;
    const storageQuotaBytes = Math.max(GIB, Math.min(plan.maxStorageQuotaBytes, Math.round((plan.defaultStorageQuotaBytes * (0.5 + rng())) / GIB) * GIB));
    const vmQuota = Math.max(1, Math.min(plan.maxVmQuota, Math.round(plan.defaultVmQuota * (0.5 + rng()))));
    const usage = rng() < 0.04 ? 1 + rng() * 0.1 : rng(); // about 4% over quota
    return {
      id, name, displayName: titleCase(name), status, planId, resellerId,
      adminEmail: `admin@${name}.test`, createdAt: iso(this.seedTime - rng() * 3 * 365 * DAY),
      storageUsedBytes: Math.round(storageQuotaBytes * usage), storageQuotaBytes,
      vmCount: Math.min(vmQuota, int(rng, 0, 20)), vmQuota,
    };
  }

  addTenant(t: Tenant): void {
    if (!this.tenants.has(t.id)) this.tenantOrder.push(t.id);
    this.tenants.set(t.id, t);
  }

  // ── VMs ──
  private seedAcmeVms(rng: Rng): void {
    const statuses = shuffle(rng, [...Array<VmStatus>(28).fill('running'), ...Array<VmStatus>(10).fill('stopped'), ...Array<VmStatus>(2).fill('error')]);
    const ids = VM_NAMES.map((name, i) => {
      const id = `vm_${String(i + 1).padStart(2, '0')}`; // F5: vm_01 = web-01
      this.vms.set(id, makeVm(rng, id, 't_acme', name, statuses[i] as VmStatus, this.seedTime));
      return id;
    });
    this.vmIdsByTenant.set('t_acme', ids);
  }

  /** VMs of other tenants are generated lazily but deterministically from (seed, tenantId) (D2-06). */
  vmsOf(tenantId: string): Vm[] {
    let ids = this.vmIdsByTenant.get(tenantId);
    if (!ids) {
      const tenant = this.tenants.get(tenantId);
      if (!tenant) return [];
      const rng = createRng(this.seed ^ hash(tenantId));
      const suffix = tenantId.replace(/^t_/, '');
      ids = Array.from({ length: tenant.vmCount }, (_, i) => {
        const id = `vm_${suffix}_${String(i + 1).padStart(2, '0')}`;
        const status: VmStatus = rng() < 0.7 ? 'running' : rng() < 0.83 ? 'stopped' : 'error';
        this.vms.set(id, makeVm(rng, id, tenantId, `vm-${String(i + 1).padStart(2, '0')}`, status, this.seedTime));
        return id;
      });
      this.vmIdsByTenant.set(tenantId, ids);
    }
    return ids.map((id) => this.vms.get(id) as Vm);
  }

  vm(id: string): Vm | undefined {
    const known = this.vms.get(id);
    if (known) return known;
    const m = /^vm_([a-z0-9]{5})_\d{2}$/.exec(id);
    if (!m) return undefined;
    this.vmsOf(`t_${m[1]}`);
    return this.vms.get(id);
  }

  // ── Buckets ──
  private seedAcmeBuckets(): void {
    for (const [i, [name, gib, objects]] of ACME_BUCKETS.entries()) {
      this.buckets.set(name, {
        name, tenantId: 't_acme', createdAt: iso(this.seedTime - (400 - i * 20) * DAY),
        sizeBytes: gib * GIB, objectCount: objects, versioning: i % 3 === 0,
      });
    }
  }

  /**
   * Buckets of other tenants are generated lazily but deterministically from (seed, tenantId), like their
   * VMs (D8-04): 1–8 buckets whose sizes add up to the tenant's usage; none when nothing is used.
   */
  bucketsOf(tenantId: string): Bucket[] {
    if (!this.bucketTenants.has(tenantId)) {
      this.bucketTenants.add(tenantId);
      const tenant = this.tenants.get(tenantId);
      if (tenant && tenant.storageUsedBytes > 0) {
        const rng = createRng(this.seed ^ hash(`buckets:${tenantId}`));
        const words = shuffle(rng, [...BUCKET_WORDS]).slice(0, int(rng, 1, 8));
        const weights = words.map(() => 0.2 + rng());
        const total = weights.reduce((a, b) => a + b, 0);
        let left = tenant.storageUsedBytes;
        words.forEach((word, i) => {
          const sizeBytes = i === words.length - 1 ? left : Math.floor((tenant.storageUsedBytes * (weights[i] as number)) / total);
          left -= sizeBytes;
          const name = `${tenant.name}-${word}`.slice(0, 63);
          if (this.buckets.has(name)) return;
          this.buckets.set(name, {
            name, tenantId, createdAt: iso(this.seedTime - int(rng, 1, 600) * DAY),
            sizeBytes, objectCount: sizeBytes === 0 ? 0 : int(rng, 1, 50_000), versioning: rng() < 0.3,
          });
        });
      }
    }
    return [...this.buckets.values()].filter((b) => b.tenantId === tenantId);
  }

  // ── Tasks (seeded relative to the seed time, F5 / E3) ──
  private seedTasks(): void {
    const at = (ms: number) => iso(this.seedTime - ms);
    const done = (id: string, kind: Task['kind'], resource: Task['resource'], ago: number, failed = false): Task => ({
      id, kind, status: failed ? 'failed' : 'succeeded', progress: failed ? 60 : 100, seq: 10, resource, tenantId: 't_acme',
      error: failed ? { title: 'VM busy', status: 409, code: 'VM_BUSY', params: { name: resource.name } } : null,
      createdAt: at(ago), finishedAt: at(ago - 5000),
    });
    const vm = (id: string, name: string) => ({ type: 'vm' as const, id, name });
    for (const t of [
      done('task_seed1', 'vm.start', vm('vm_01', 'web-01'), 10 * MINUTE),
      done('task_seed2', 'vm.stop', vm('vm_19', 'worker-03'), 30 * MINUTE),
      done('task_seed3', 'vm.reboot', vm('vm_14', 'db-02'), 60 * MINUTE, true),
      done('task_seed4', 'vm.reboot', vm('vm_37', 'cache-01'), 2 * HOUR),
      done('task_seed5', 'tenant.provision', { type: 'tenant', id: 't_acme', name: 'acme' }, 4 * HOUR),
    ]) this.tasks.set(t.id, t);
  }
}

function makeVm(rng: Rng, id: string, tenantId: string, name: string, status: VmStatus, now: number): Vm {
  return {
    id, tenantId, name, status,
    vcpus: int(rng, 1, 16), memoryMiB: int(rng, 1, 64) * 1024, diskGiB: int(rng, 20, 500),
    ip: status === 'running' ? `10.0.${int(rng, 0, 255)}.${int(rng, 1, 254)}` : null,
    image: pick(rng, IMAGES), activeTaskId: null, createdAt: iso(now - int(rng, 1, 600) * DAY),
  };
}

const iso = (ms: number) => new Date(ms).toISOString();
const titleCase = (slug: string) => slug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
