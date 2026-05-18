/**
 * Tests for ERPNext sync service.
 *
 * Verifies:
 * - Disabled mode → all methods return immediately
 * - Enabled mode:
 *   - upsertContact: find existing contact, create new, update existing
 *   - upsertContact: graceful failure when ERPNext is unreachable
 *   - queueCommunication: buffer and flush behavior
 *   - fetchCampaigns: GET from ERPNext, parse response
 *   - Error response from ERPNext (non-200) → logged but not thrown
 *   - healthCheck: success and failure paths
 */

// Set env before imports — disabled singleton for the first describe block
process.env.ENABLE_ERPNEXT_SYNC = 'false';
process.env.ERPNEXT_URL = '';
process.env.ERPNEXT_API_KEY = '';
process.env.ERPNEXT_API_SECRET = '';

import { erpnextSync } from '../../../src/services/erpnextSync';

describe('ERPNextSyncService', () => {
  describe('when disabled', () => {
    it('upsertContact returns null', async () => {
      const result = await erpnextSync.upsertContact('+254712345678', 'Test User');
      expect(result).toBeNull();
    });

    it('queueCommunication does nothing', () => {
      expect(() => {
        erpnextSync.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Hello',
          direction: 'Received',
        });
      }).not.toThrow();
    });

    it('fetchCampaigns returns empty array', async () => {
      const result = await erpnextSync.fetchCampaigns();
      expect(result).toEqual([]);
    });

    it('healthCheck returns false', async () => {
      const result = await erpnextSync.healthCheck();
      expect(result).toBe(false);
    });

    it('startBatchTimer is a no-op', () => {
      expect(() => erpnextSync.startBatchTimer()).not.toThrow();
    });

    it('stopBatchTimer is a no-op', async () => {
      await expect(erpnextSync.stopBatchTimer()).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Enabled mode tests
  //
  // Uses jest.isolateModules to re-import the module with mocked config so
  // the ERPNextSyncService constructor creates a real (mocked) axios client.
  // ---------------------------------------------------------------------------

  describe('when enabled', () => {
    // Mock axios instance methods
    const mockGet = jest.fn();
    const mockPost = jest.fn();
    const mockPut = jest.fn();

    // We need to create a fresh module instance for each test to avoid
    // shared state in the communication buffer.
    function createEnabledService() {
      let service: typeof erpnextSync;

      jest.isolateModules(() => {
        // Mock config to return enabled
        jest.doMock('../../../src/shared/config', () => ({
          erpnextConfig: {
            enabled: true,
            baseUrl: 'https://erp.test.local',
            apiKey: 'test-api-key',
            apiSecret: 'test-api-secret',
            webhookSecret: 'test-webhook-secret',
            refreshIntervalMs: 300000,
            batchFlushIntervalMs: 10000,
          },
          config: {
            port: 3001,
            apiKey: 'test-api-key',
            whatsappApiUrl: 'http://whatsapp-api:3000',
            mongodbUri: 'mongodb://localhost:27017/test',
            adminUser: 'admin',
            adminPassword: '',
            nodeEnv: 'test',
            n8nUrl: '',
            healthCheckTimeout: 5000,
          },
        }));

        // Mock axios.create to return our controllable mock client
        jest.doMock('axios', () => {
          const actualAxios = jest.requireActual('axios');
          return {
            ...actualAxios,
            default: {
              ...actualAxios.default,
              create: jest.fn().mockReturnValue({
                get: mockGet,
                post: mockPost,
                put: mockPut,
              }),
            },
            create: jest.fn().mockReturnValue({
              get: mockGet,
              post: mockPost,
              put: mockPut,
            }),
          };
        });

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('../../../src/services/erpnextSync') as { erpnextSync: typeof erpnextSync };
        service = mod.erpnextSync;
      });

      // TypeScript needs the definite assignment
      return service!;
    }

    beforeEach(() => {
      mockGet.mockReset();
      mockPost.mockReset();
      mockPut.mockReset();
    });

    // -------------------------------------------------------------------------
    // upsertContact
    // -------------------------------------------------------------------------

    describe('upsertContact', () => {
      it('creates a new contact when none exists', async () => {
        const service = createEnabledService();

        // findContactByPhone returns empty
        mockGet.mockResolvedValueOnce({
          data: { data: [] },
        });

        // POST to create contact
        mockPost.mockResolvedValueOnce({
          data: {
            data: {
              name: 'CONT-00001',
              first_name: 'Jane',
              last_name: 'Doe',
              mobile_no: '+254712345678',
            },
          },
        });

        const result = await service.upsertContact('+254712345678', 'Jane Doe');

        expect(result).toBe('CONT-00001');
        expect(mockGet).toHaveBeenCalledWith(
          '/api/resource/Contact',
          expect.objectContaining({
            params: expect.objectContaining({
              filters: JSON.stringify([['mobile_no', '=', '+254712345678']]),
            }),
          }),
        );
        expect(mockPost).toHaveBeenCalledWith(
          '/api/resource/Contact',
          expect.objectContaining({
            first_name: 'Jane',
            last_name: 'Doe',
            mobile_no: '+254712345678',
          }),
        );
      });

      it('updates an existing contact when found', async () => {
        const service = createEnabledService();

        // findContactByPhone returns existing
        mockGet.mockResolvedValueOnce({
          data: { data: [{ name: 'CONT-00042' }] },
        });

        // PUT to update contact
        mockPut.mockResolvedValueOnce({
          data: {
            data: {
              name: 'CONT-00042',
              first_name: 'John',
              last_name: 'Updated',
              mobile_no: '+254711222333',
            },
          },
        });

        const result = await service.upsertContact('+254711222333', 'John Updated');

        expect(result).toBe('CONT-00042');
        expect(mockPut).toHaveBeenCalledWith(
          '/api/resource/Contact/CONT-00042',
          expect.objectContaining({
            first_name: 'John',
            last_name: 'Updated',
            mobile_no: '+254711222333',
          }),
        );
      });

      it('passes optional tags as custom_wa_tags', async () => {
        const service = createEnabledService();

        mockGet.mockResolvedValueOnce({ data: { data: [] } });
        mockPost.mockResolvedValueOnce({
          data: { data: { name: 'CONT-00003', first_name: 'Test', mobile_no: '+254712345678' } },
        });

        await service.upsertContact('+254712345678', 'Test User', {
          tags: ['SOMO', 'VIP'],
          platform: 'c.us',
        });

        expect(mockPost).toHaveBeenCalledWith(
          '/api/resource/Contact',
          expect.objectContaining({
            custom_wa_tags: [{ campaign: 'SOMO' }, { campaign: 'VIP' }],
            custom_wa_platform: 'c.us',
          }),
        );
      });

      it('returns null when ERPNext is unreachable (no crash)', async () => {
        const service = createEnabledService();

        // findContactByPhone throws network error
        mockGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const result = await service.upsertContact('+254712345678', 'Test User');

        expect(result).toBeNull();
        // Should not throw
      });

      it('returns null when ERPNext returns non-200 error', async () => {
        const service = createEnabledService();

        // findContactByPhone succeeds
        mockGet.mockResolvedValueOnce({ data: { data: [] } });

        // POST fails with 500
        const error = new Error('Internal Server Error') as Error & { response?: { status: number } };
        error.response = { status: 500 };
        mockPost.mockRejectedValueOnce(error);

        const result = await service.upsertContact('+254712345678', 'Test User');

        expect(result).toBeNull();
        // Should not throw — error is logged but swallowed
      });

      it('handles single-word names correctly (no last name)', async () => {
        const service = createEnabledService();

        mockGet.mockResolvedValueOnce({ data: { data: [] } });
        mockPost.mockResolvedValueOnce({
          data: { data: { name: 'CONT-00005', first_name: 'Madonna', mobile_no: '+254712345678' } },
        });

        await service.upsertContact('+254712345678', 'Madonna');

        expect(mockPost).toHaveBeenCalledWith(
          '/api/resource/Contact',
          expect.objectContaining({
            first_name: 'Madonna',
            last_name: '',
          }),
        );
      });
    });

    // -------------------------------------------------------------------------
    // queueCommunication + flush
    // -------------------------------------------------------------------------

    describe('queueCommunication', () => {
      it('buffers a communication for later flush', async () => {
        const service = createEnabledService();

        service.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Hello from test',
          direction: 'Received',
          tag: 'SOMO',
        });

        // Nothing posted yet — still in buffer
        expect(mockPost).not.toHaveBeenCalled();

        // Trigger flush by stopping the timer (which calls flushCommunications)
        mockPost.mockResolvedValue({ data: {} });
        await service.stopBatchTimer();

        expect(mockPost).toHaveBeenCalledWith(
          '/api/resource/Communication',
          expect.objectContaining({
            communication_type: 'Chat',
            communication_medium: 'Chat',
            content: 'Hello from test',
            sender: '+254712345678',
            sent_or_received: 'Received',
            subject: 'WhatsApp [SOMO]',
          }),
        );
      });

      it('sets recipients for sent messages', async () => {
        const service = createEnabledService();

        service.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Bot reply',
          direction: 'Sent',
        });

        mockPost.mockResolvedValue({ data: {} });
        await service.stopBatchTimer();

        expect(mockPost).toHaveBeenCalledWith(
          '/api/resource/Communication',
          expect.objectContaining({
            recipients: '+254712345678',
            sender: undefined,
            sent_or_received: 'Sent',
          }),
        );
      });

      it('flushes multiple buffered communications', async () => {
        const service = createEnabledService();

        service.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Message 1',
          direction: 'Received',
        });

        service.queueCommunication({
          phone: '+254711222333',
          messageBody: 'Message 2',
          direction: 'Received',
        });

        service.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Reply',
          direction: 'Sent',
        });

        mockPost.mockResolvedValue({ data: {} });
        await service.stopBatchTimer();

        expect(mockPost).toHaveBeenCalledTimes(3);
      });

      it('handles flush failure gracefully (does not re-queue)', async () => {
        const service = createEnabledService();

        service.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Will fail',
          direction: 'Received',
        });

        // First POST fails
        mockPost.mockRejectedValueOnce(new Error('ERPNext down'));
        await service.stopBatchTimer();

        expect(mockPost).toHaveBeenCalledTimes(1);

        // Second flush should have nothing to send
        mockPost.mockClear();
        await service.stopBatchTimer();

        expect(mockPost).not.toHaveBeenCalled();
      });
    });

    // -------------------------------------------------------------------------
    // fetchCampaigns
    // -------------------------------------------------------------------------

    describe('fetchCampaigns', () => {
      it('fetches campaigns from ERPNext and returns them', async () => {
        const service = createEnabledService();

        const mockCampaigns = [
          {
            name: 'CAM-001',
            campaign_name: 'Somo Buruka',
            status: 'Active',
            custom_wa_tag: 'SOMO',
            custom_wa_display_name: 'Somo Buruka Learning',
            custom_wa_routing_targets: '[]',
            custom_wa_system_prompt: 'You are a learning assistant',
            custom_wa_welcome_messages: '[]',
            custom_wa_regex_pattern: 'somo|buruka',
            custom_wa_voice_prompt_number: '+254700000000',
          },
          {
            name: 'CAM-002',
            campaign_name: 'VIP Support',
            status: 'Active',
            custom_wa_tag: 'VIP',
            custom_wa_display_name: 'VIP Support',
          },
        ];

        mockGet.mockResolvedValueOnce({
          data: { data: mockCampaigns },
        });

        const result = await service.fetchCampaigns();

        expect(result).toHaveLength(2);
        expect(result[0].custom_wa_tag).toBe('SOMO');
        expect(result[1].campaign_name).toBe('VIP Support');

        expect(mockGet).toHaveBeenCalledWith(
          '/api/resource/Campaign',
          expect.objectContaining({
            params: expect.objectContaining({
              fields: expect.any(String),
              filters: expect.stringContaining('Cancelled'),
              limit_page_length: 100,
            }),
          }),
        );
      });

      it('returns empty array when ERPNext returns error', async () => {
        const service = createEnabledService();

        mockGet.mockRejectedValueOnce(new Error('ERPNext unreachable'));

        const result = await service.fetchCampaigns();

        expect(result).toEqual([]);
        // Should not throw
      });

      it('returns empty array when ERPNext returns non-200', async () => {
        const service = createEnabledService();

        const error = new Error('Forbidden') as Error & { response?: { status: number } };
        error.response = { status: 403 };
        mockGet.mockRejectedValueOnce(error);

        const result = await service.fetchCampaigns();

        expect(result).toEqual([]);
      });
    });

    // -------------------------------------------------------------------------
    // healthCheck
    // -------------------------------------------------------------------------

    describe('healthCheck', () => {
      it('returns true when ERPNext API responds', async () => {
        const service = createEnabledService();

        mockGet.mockResolvedValueOnce({
          data: { message: 'admin@test.com' },
        });

        const result = await service.healthCheck();

        expect(result).toBe(true);
        expect(mockGet).toHaveBeenCalledWith('/api/method/frappe.auth.get_logged_user');
      });

      it('returns false when ERPNext API is unreachable', async () => {
        const service = createEnabledService();

        mockGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const result = await service.healthCheck();

        expect(result).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // Batch timer lifecycle
    // -------------------------------------------------------------------------

    describe('batch timer', () => {
      it('startBatchTimer does not throw when enabled', () => {
        const service = createEnabledService();

        expect(() => service.startBatchTimer()).not.toThrow();

        // Clean up timer
        void service.stopBatchTimer();
      });

      it('stopBatchTimer flushes remaining and clears timer', async () => {
        const service = createEnabledService();

        service.startBatchTimer();

        service.queueCommunication({
          phone: '+254712345678',
          messageBody: 'Pending message',
          direction: 'Received',
        });

        mockPost.mockResolvedValue({ data: {} });
        await service.stopBatchTimer();

        // The pending message should have been flushed
        expect(mockPost).toHaveBeenCalledWith(
          '/api/resource/Communication',
          expect.objectContaining({
            content: 'Pending message',
          }),
        );
      });
    });
  });
});
