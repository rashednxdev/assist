import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { DeviceToken } from './models/DeviceToken.model.js';

const expo = new Expo();

/**
 * Sends a push message to every active device token for the given users, chunked to Expo's
 * 100-message-per-request limit. Deactivates tokens Expo already flags as malformed at send time
 * (an invalid token never gets a ticket id, so there's nothing to check via receipts for those).
 * Delivery-confirmation receipts (which additionally catch DeviceNotRegistered post-delivery) are
 * checked on a short delay after send — see checkReceiptsLater below.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };

  const tokens = await DeviceToken.find({ user_id: { $in: userIds }, is_active: true });
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messages: ExpoPushMessage[] = [];
  for (const t of tokens) {
    if (!Expo.isExpoPushToken(t.expo_push_token)) continue;
    messages.push({
      to: t.expo_push_token,
      title,
      body: message,
      data,
      sound: 'default',
      priority: 'high',
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    try {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
    } catch {
      // A whole-chunk failure (network/service error) — leave those tokens alone, they'll be
      // retried on the next broadcast rather than deactivated on a transient failure.
    }
  }

  let sent = 0;
  let failed = 0;
  const receiptIds: string[] = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]!;
    if (ticket.status === 'ok') {
      sent += 1;
      receiptIds.push(ticket.id);
    } else {
      failed += 1;
      if (ticket.details?.error === 'DeviceNotRegistered' && ticket.details.expoPushToken) {
        await DeviceToken.updateOne(
          { expo_push_token: ticket.details.expoPushToken },
          { is_active: false },
        );
      }
    }
  }

  if (receiptIds.length > 0) checkReceiptsLater(receiptIds);

  return { sent, failed };
}

/** Expo receipts (delivery confirmation) aren't ready immediately — check back in 15 minutes. */
function checkReceiptsLater(receiptIds: string[]) {
  setTimeout(
    () => {
      void checkReceipts(receiptIds).catch(() => {
        // Best-effort cleanup — a missed receipt sweep just means a stale token lingers a bit longer.
      });
    },
    15 * 60 * 1000,
  );
}

async function checkReceipts(receiptIds: string[]) {
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  for (const chunk of chunks) {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    for (const receipt of Object.values(receipts)) {
      if (
        receipt.status === 'error' &&
        receipt.details?.error === 'DeviceNotRegistered' &&
        receipt.details.expoPushToken
      ) {
        await DeviceToken.updateOne(
          { expo_push_token: receipt.details.expoPushToken },
          { is_active: false },
        );
      }
    }
  }
}
