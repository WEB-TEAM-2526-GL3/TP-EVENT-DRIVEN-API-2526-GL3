import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookEvent } from '../enums/webhook-event.enum';

// Type used to store the result of each webhook delivery attempt.
type WebhookDispatchResult = {
  url: string;
  success: boolean;
  status?: number;
  error?: string;
};

// Type used to store received webhook payloads in memory for testing.
type ReceivedWebhook = {
  id: number;
  event: string | undefined;
  signature: string | undefined;
  body: Record<string, unknown>;
  receivedAt: Date;
};

@Injectable()
export class WebhooksService {
  // Stores received webhooks temporarily until the server restarts.
  private receivedWebhooks: ReceivedWebhook[] = [];

  // Injects the webhook subscription repository to access the database.
  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly webhookRepository: Repository<WebhookSubscription>,
  ) {}

  // Creates a new webhook subscription for a specific event and URL.
  async createSubscription(data: {
    url: string;
    event: WebhookEvent;
    secret?: string;
  }) {
    if (!data.url || !data.url.startsWith('http')) {
      throw new BadRequestException('Valid webhook URL is required');
    }

    if (!Object.values(WebhookEvent).includes(data.event)) {
      throw new BadRequestException('Invalid webhook event');
    }

    const subscription = this.webhookRepository.create({
      url: data.url,
      event: data.event,
      secret: data.secret,
      isActive: true,
    });

    return this.webhookRepository.save(subscription);
  }

  // Returns all registered webhook subscriptions.
  findAll() {
    return this.webhookRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // Deletes a webhook subscription by its id.
  async deleteSubscription(id: number) {
    await this.webhookRepository.delete(id);

    return {
      message: `Webhook subscription ${id} deleted`,
    };
  }

  // Sends a webhook POST request to all active subscriptions of an event.
  async dispatch(event: WebhookEvent, data: Record<string, unknown>) {
    const subscriptions = await this.webhookRepository.find({
      where: {
        event,
        isActive: true,
      },
    });

    const payload = {
      event,
      data,
      sentAt: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);

    const results: WebhookDispatchResult[] = [];

    for (const subscription of subscriptions) {
      try {
        const signature = subscription.secret
          ? this.signPayload(body, subscription.secret)
          : undefined;

        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CvTech-Event': event,
            ...(signature ? { 'X-CvTech-Signature': signature } : {}),
          },
          body,
        });
        // The results table contains the delivery result for each webhook URL
        results.push({
          url: subscription.url,
          success: response.ok,
          status: response.status,
        });
      } catch (error: unknown) {
        results.push({
          url: subscription.url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      event,
      deliveredTo: results.length,
      results,
    };
  }

  // Saves a webhook received by the test receiver so we can view it later.
  saveReceivedWebhook(data: {
    event: string | undefined;
    signature: string | undefined;
    body: Record<string, unknown>;
  }) {
    const receivedWebhook: ReceivedWebhook = {
      id: this.receivedWebhooks.length + 1,
      event: data.event,
      signature: data.signature,
      body: data.body,
      receivedAt: new Date(),
    };

    this.receivedWebhooks.unshift(receivedWebhook);

    return receivedWebhook;
  }

  // Returns all received webhook payloads stored in memory.
  findReceivedWebhooks() {
    return this.receivedWebhooks;
  }

  // Clears the received webhook test history.
  clearReceivedWebhooks() {
    this.receivedWebhooks = [];

    return {
      message: 'Received webhooks cleared',
    };
  }

  // Creates an HMAC SHA256 signature to prove the webhook came from our app.
  private signPayload(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }
}
