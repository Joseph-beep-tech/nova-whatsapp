import { Router, Request, Response } from 'express';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppApiClient, SendMessageRequest } from '../dispatcher/whatsappApiClient';

const router = Router();

// API Client (injected at setup time)
let apiClient: WhatsAppApiClient | null = null;

export function initCampaignsRoutes(client: WhatsAppApiClient): void {
    apiClient = client;
}

/**
 * Trigger a bulk broadcast campaign
 * POST /campaigns/broadcast
 * Body: { tag: string, message: string, sessionId?: string }
 */
router.post('/broadcast', async (req: Request, res: Response) => {
    try {
        const { tag, message, sessionId = 'default' } = req.body as {
            tag?: string;
            message?: string;
            sessionId?: string;
        };

        if (!tag || !message) {
            return res.status(400).json({
                success: false,
                error: 'tag and message are required',
            });
        }

        if (!apiClient) {
            return res.status(500).json({
                success: false,
                error: 'WhatsApp API client not initialized',
            });
        }

        // Find all users with this tag (the whitelist)
        const users = await stateManager.getUsersByTag(tag);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No users found with tag: ${tag}`,
            });
        }

        // Send to each user
        const results = [];
        for (const user of users) {
            try {
                const reqData: SendMessageRequest = {
                    chatId: `${user.identifier}@c.us`,
                    contentType: 'string',
                    content: message,
                };

                const response = await apiClient.sendMessage(sessionId, reqData);
                results.push({ identifier: user.identifier, success: true, response });
            } catch (err: unknown) {
                results.push({ identifier: user.identifier, success: false, error: getErrorMessage(err) });
            }
        }

        res.json({
            success: true,
            tag,
            sentCount: results.filter(r => r.success).length,
            totalUsers: users.length,
            results
        });
    } catch (error: unknown) {
        console.error('Campaign broadcast error:', getErrorMessage(error));
        res.status(500).json({
            success: false,
            error: getErrorMessage(error),
        });
    }
});

export { router as campaignsRouter };
