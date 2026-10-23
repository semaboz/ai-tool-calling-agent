/** Synthetic fixtures: no private employer data or production credentials. */
export const services = [
  { id: 'payments-api', status: 'degraded', requests: 1200, failures: 36, latencyP95Ms: 850, updatedAt: '2026-10-20T10:00:00Z' },
  { id: 'auth-service', status: 'operational', requests: 3000, failures: 2, latencyP95Ms: 95, updatedAt: '2026-10-20T10:00:00Z' },
  { id: 'notification-worker', status: 'operational', requests: 800, failures: 0, latencyP95Ms: 140, updatedAt: '2026-10-20T10:00:00Z' },
] as const;

export const incidents = [
  { id: 'INC-104', serviceId: 'payments-api', severity: 'high', summary: 'Intermittent payment timeouts during peak traffic', state: 'investigating' },
  { id: 'INC-099', serviceId: 'payments-api', severity: 'medium', summary: 'Increased payment authorization latency', state: 'resolved' },
  { id: 'INC-102', serviceId: 'auth-service', severity: 'low', summary: 'Short-lived authentication login errors', state: 'resolved' },
  { id: 'INC-098', serviceId: 'notification-worker', severity: 'low', summary: 'Delayed notification deliveries', state: 'resolved' },
] as const;
