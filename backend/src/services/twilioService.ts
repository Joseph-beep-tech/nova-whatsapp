/**
 * Twilio Service
 *
 * Wraps the Twilio Node SDK for: searching available numbers, purchasing them,
 * and re-configuring the Voice URL + Status Callback on numbers we already own.
 *
 * Credentials come from the user's encrypted AICredentials record. If the user
 * hasn't saved Twilio creds, every method throws a clear "twilio_not_configured"
 * error that the routes turn into a 412 with actionable copy.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const twilio = require('twilio');

import { prisma } from '../lib/prisma';
import { decrypt } from '../utils/credentialsCrypto';

export class TwilioNotConfiguredError extends Error {
  constructor() {
    super('twilio_not_configured');
    this.name = 'TwilioNotConfiguredError';
  }
}

interface AvailableNumber {
  phoneNumber: string;       // e.g. "+12025551234"
  friendlyName: string;
  locality: string | null;
  region: string | null;
  isoCountry: string;
  capabilities: { voice: boolean; SMS: boolean; MMS: boolean };
}

class TwilioServiceImpl {
  async hasCredentials(userId: string): Promise<boolean> {
    const creds = await prisma.aICredentials.findFirst({ where: { userId } });
    if (!creds?.twilioAccountSid) return false;
    if (!creds?.twilioAuthToken) return false;
    return true;
  }

  private async getClient(userId: string) {
    const creds = await prisma.aICredentials.findFirst({ where: { userId } });
    if (!creds?.twilioAccountSid || !creds?.twilioAuthToken) throw new TwilioNotConfiguredError();
    const sid = creds.twilioAccountSid; // SID is plain text (PLAIN_FIELDS)
    const token = decrypt(creds.twilioAuthToken);
    if (!token) throw new TwilioNotConfiguredError();
    return twilio(sid, token);
  }

  /**
   * Search Twilio's inventory for available numbers.
   * `country` is an ISO-3166 alpha-2 (e.g. "US", "GB", "KE"). `type` chooses
   * the local/mobile/tollFree resource (Twilio uses different endpoints).
   */
  async searchAvailable(
    userId: string,
    opts: { country: string; areaCode?: string; contains?: string; type?: 'local' | 'mobile' | 'tollFree' }
  ): Promise<AvailableNumber[]> {
    const client = await this.getClient(userId);
    const country = (opts.country || 'US').toUpperCase();
    const type = opts.type || 'local';

    const params: Record<string, unknown> = { limit: 20 };
    if (opts.areaCode) params.areaCode = opts.areaCode;
    if (opts.contains) params.contains = opts.contains;

    const list = await client
      .availablePhoneNumbers(country)[type]
      .list(params);

    return list.map((n: any) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality || null,
      region: n.region || null,
      isoCountry: n.isoCountry,
      capabilities: {
        voice: !!n.capabilities?.voice,
        SMS: !!n.capabilities?.SMS,
        MMS: !!n.capabilities?.MMS,
      },
    }));
  }

  /**
   * Buy a phone number AND configure it in one round-trip:
   *  - voiceUrl   → our TwiML bridge endpoint
   *  - statusCallback → our status endpoint (call lifecycle)
   */
  async purchase(
    userId: string,
    args: { phoneNumber: string; voiceUrl: string; statusCallback?: string; friendlyName?: string }
  ): Promise<{ sid: string; phoneNumber: string; voiceUrl: string; statusCallback: string | null }> {
    const client = await this.getClient(userId);
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: args.phoneNumber,
      voiceUrl: args.voiceUrl,
      voiceMethod: 'POST',
      statusCallback: args.statusCallback,
      statusCallbackMethod: args.statusCallback ? 'POST' : undefined,
      friendlyName: args.friendlyName,
    });
    return {
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      voiceUrl: purchased.voiceUrl,
      statusCallback: purchased.statusCallback || null,
    };
  }

  /**
   * Update the Voice URL + Status Callback on an existing Twilio number.
   * `phoneNumberOrSid` accepts either the E.164 number ("+12025551234") or the
   * IncomingPhoneNumber SID ("PNxxxxxx").
   */
  async syncConfig(
    userId: string,
    phoneNumberOrSid: string,
    voiceUrl: string,
    statusCallback?: string
  ): Promise<{ sid: string; phoneNumber: string; voiceUrl: string; statusCallback: string | null } | null> {
    const client = await this.getClient(userId);

    // If it's a SID, update directly. Otherwise look it up first.
    let sid: string | null = null;
    if (/^PN[0-9a-f]{32}$/i.test(phoneNumberOrSid)) {
      sid = phoneNumberOrSid;
    } else {
      const list = await client.incomingPhoneNumbers.list({ phoneNumber: phoneNumberOrSid, limit: 1 });
      if (list.length === 0) return null;
      sid = list[0].sid;
    }

    const updated = await client.incomingPhoneNumbers(sid).update({
      voiceUrl,
      voiceMethod: 'POST',
      statusCallback,
      statusCallbackMethod: statusCallback ? 'POST' : undefined,
    });
    return {
      sid: updated.sid,
      phoneNumber: updated.phoneNumber,
      voiceUrl: updated.voiceUrl,
      statusCallback: updated.statusCallback || null,
    };
  }

  /**
   * List numbers the user already owns on Twilio (useful for the "import existing"
   * flow — picks numbers that aren't yet in our PhoneNumber collection).
   */
  async listOwned(userId: string) {
    const client = await this.getClient(userId);
    const list = await client.incomingPhoneNumbers.list({ limit: 100 });
    return list.map((n: any) => ({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      voiceUrl: n.voiceUrl || null,
      statusCallback: n.statusCallback || null,
    }));
  }
}

export const twilioService = new TwilioServiceImpl();
