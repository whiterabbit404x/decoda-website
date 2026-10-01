import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workosClientOptions } from './workos';

test('deployments talk to api.workos.com over https (no overrides set)', () => {
  assert.deepEqual(workosClientOptions('client_01WEBSITE', {}), { clientId: 'client_01WEBSITE', https: true });
});

test('the platform client follows the same API host overrides as AuthKit', () => {
  const env = { WORKOS_API_HOSTNAME: '127.0.0.1', WORKOS_API_PORT: '4560', WORKOS_API_HTTPS: 'false' };
  assert.deepEqual(workosClientOptions('client_01WEBSITE', env), {
    clientId: 'client_01WEBSITE',
    apiHostname: '127.0.0.1',
    https: false,
    port: 4560,
  });
  // AuthKit treats any value other than "true" as http, and an unset value as https.
  assert.equal(workosClientOptions('c', { WORKOS_API_HTTPS: 'true' }).https, true);
  assert.equal(workosClientOptions('c', { WORKOS_API_HTTPS: 'yes' }).https, false);
});
