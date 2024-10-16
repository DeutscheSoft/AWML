import { fromSubscription } from './from_subscription.js';
import { safeCall } from '../utils/safe_call.js';

export function observeLatest(dv, callback) {
  let subscribed = false;
  let pendingSetCount = 0;
  let lastSent;
  let lastReceived;

  const notify = () => {
    if (pendingSetCount) {
      safeCall(callback, true, lastSent);
    } else if (subscribed) {
      safeCall(callback, true, lastReceived);
    } else {
      safeCall(callback, false);
    }
  };

  return fromSubscription(
    (callback) => {
      subscribed = true;
      const unsubscribe = dv.subscribe((value) => {
        lastReceived = value;
        notify();
        callback(value);
      });

      return () => {
        if (!subscribed) return;
        subscribed = false;
        notify();
        unsubscribe();
      };
    },
    async (value) => {
      try {
        pendingSetCount++;
        lastSent = value;
        notify();
        await dv.set(value);
      } finally {
        if (!--pendingSetCount) notify();
      }
    }
  );
}
