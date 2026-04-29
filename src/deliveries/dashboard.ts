import { defineDelivery } from '@/core/define-plugin';

export function createDashboardDelivery() {
  return defineDelivery({
    name: 'dashboard',
    async deliver(_actionRun, _company, _config, _ctx) {
      // No-op: the action_run is already in Postgres and visible
      // in the dashboard. Exists so triggers can list ['dashboard']
      // without special-casing.
    },
  });
}
