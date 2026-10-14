import { strict as assert } from 'assert';
import analytics, { SHARE_INTERNAL } from 'analytics';
import Native from 'native';
import { Lbryio } from 'lbryinc';
import { tick } from './helpers';

const scripts = () => Array.from(document.scripts).filter((script) => script.src.endsWith('/matomo.js'));

export default async function testAnalytics(phase, history) {
  if (phase === 'analyticsDisabled') {
    assert.equal(localStorage.getItem(SHARE_INTERNAL), 'false');
    assert.equal(scripts().length, 0, 'Restart after opt-out must not load the tracker');
    assert.equal(window._paq, undefined);
    return 'analytics opt-out survives restart without requesting a tracking script';
  }
  if (phase === 'analyticsUnconfigured') {
    analytics.toggleInternal(true);
    analytics.pageView('/missing-configuration');
    analytics.startupEvent();
    analytics.setUser('synthetic-user');
    assert.equal(window._paq, undefined, 'Missing configuration must leave the tracker inactive');
    assert.equal(scripts().length, 0);
    const config = require('config');
    config.MATOMO_URL = 'https://analytics.lbry.com/';
    config.MATOMO_ID = '';
    analytics.pageView('/missing-site-id');
    analytics.startupEvent();
    assert.equal(window._paq, undefined, 'A missing site ID must not invoke the new constructor');
    analytics.toggleInternal(false);
    return 'analytics without a server configuration does not break startup';
  }
  if (phase === 'analyticsEnabled') {
    assert.equal(localStorage.getItem(SHARE_INTERNAL), 'true');
    assert.equal(scripts().length, 1);
    assert.equal(window._paq.filter(([name]) => name === 'trackPageView').length, 1);
    assert(
      window._paq.findIndex(([name]) => name === 'requireConsent') <
        window._paq.findIndex(([name]) => name === 'setConsentGiven')
    );
    analytics.toggleInternal(false);
    await tick();
    return 'saved analytics consent starts one tracker and one initial page view';
  }

  assert.equal(scripts().length, 0, 'Sharing disabled must not inject any tracker');
  assert.equal(window._paq, undefined);
  const originalCall = Lbryio.call;
  const originalVersions = Native.getAppVersionInfo;
  const calls = [];
  let releaseVersion;
  Lbryio.call = (...args) => {
    calls.push(args);
    return Promise.resolve();
  };
  Native.getAppVersionInfo = () =>
    new Promise((resolve) => {
      releaseVersion = resolve;
    });
  try {
    analytics.pageView('/disabled');
    analytics.startupEvent();
    analytics.setUser('disabled-user');
    assert.equal(await analytics.error('disabled error'), false);
    await analytics.apiLogView('disabled', 'outpoint', 'claim');
    analytics.apiLogSearch();
    analytics.apiLogPublish({ permanent_url: 'disabled' });
    analytics.apiSyncTags({ tags: ['disabled'] });
    assert.deepEqual(calls, [], 'Opt-out gates the legacy API reporting too');
    assert.equal(window._paq, undefined);

    analytics.toggleInternal(true);
    assert.equal(localStorage.getItem(SHARE_INTERNAL), 'true');
    assert.equal(await analytics.error('synthetic error'), true);
    await analytics.apiLogView('fixture', 'outpoint', 'claim', 12);
    assert.deepEqual(calls, [
      ['event', 'desktop_error', { error_message: 'synthetic error' }],
      ['file', 'view', { uri: 'fixture', outpoint: 'outpoint', claim_id: 'claim', time_to_start: 12 }],
    ]);
    analytics.pageView('/fixture?src=test', '?src=test');
    assert.equal(scripts().length, 1);
    assert.deepEqual(window._paq.slice(0, 4), [
      ['setTrackerUrl', 'https://analytics.lbry.com/matomo.php'],
      ['setSiteId', '4'],
      ['requireConsent'],
      ['setConsentGiven'],
    ]);
    assert(window._paq.some((entry) => entry[0] === 'setCustomDimension' && entry[1] === 1 && entry[2] === 'test'));
    analytics.startupEvent();
    assert(window._paq.some((entry) => entry[0] === 'trackEvent' && entry[1] === 'Startup'));
    assert(!window._paq.some(([name]) => name === 'enableHeartBeatTimer'));
    assert(!window._paq.some(([name]) => name === 'enableLinkTracking'));
    analytics.setUser('synthetic-user');
    assert(window._paq.some((entry) => entry[0] === 'setUserId' && entry[1] === 'synthetic-user'));

    // The script has not loaded. Withdraw consent before it can process any queued activity.
    analytics.toggleInternal(false);
    releaseVersion({ localVersion: 'test-version' });
    await tick();
    assert.deepEqual(
      window._paq.map(([name]) => name),
      ['setTrackerUrl', 'setSiteId', 'requireConsent', 'forgetConsentGiven', 'resetUserId']
    );
    analytics.pageView('/private-after-opt-out');
    assert.equal(window._paq.length, 5);

    // Once matomo.js loads, it replaces the array with an object that consumes push calls.
    // Inspect that public command boundary without contacting the tracking service.
    const commands = [];
    window._paq = { push: (instruction) => commands.push(instruction) };
    analytics.toggleInternal(true);
    analytics.toggleInternal(true);
    assert.deepEqual(commands, [['setConsentGiven']], 'Repeated settings refresh must not reinitialize consent');
    history.push('/analytics-route?src=fixture');
    await tick();
    assert.equal(commands.filter(([name]) => name === 'trackPageView').length, 1);
    assert(commands.some((entry) => entry[0] === 'setCustomUrl' && entry[1] === '/analytics-route?src=fixture'));
    analytics.toggleInternal(false);
    assert.deepEqual(commands.slice(-2), [['forgetConsentGiven'], ['resetUserId']]);
    const count = commands.length;
    history.push('/private-route');
    analytics.startupEvent();
    analytics.setUser('private-user');
    await tick();
    assert.equal(commands.length, count, 'Opt-out stops route, event and user commands');
    assert.equal(scripts().length, 1, 'Toggling consent must reuse the loaded tracker');
    analytics.toggleInternal(true); // Exercise saved opt-in in the next fresh renderer.
  } finally {
    Lbryio.call = originalCall;
    Native.getAppVersionInfo = originalVersions;
  }
  return 'Matomo opt-in, route/event payloads, slow-script opt-out, identity reset and delayed callback suppression';
}
