import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookEvent } from '../enums/webhook-event.enum';

type WebhookDispatchResult = {
  url: string;
  success: boolean;
  status?: number;
  error?: string;
};

type ReceivedWebhook = {
  id: number;
  event: string | undefined;
  signature: string | undefined;
  body: Record<string, unknown>;
  receivedAt: Date;
};

@Injectable()
export class WebhooksService {
  private receivedWebhooks: ReceivedWebhook[] = [];

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly webhookRepository: Repository<WebhookSubscription>,
  ) {}

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

  findAll() {
    return this.webhookRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async deleteSubscription(id: number) {
    await this.webhookRepository.delete(id);

    return {
      message: `Webhook subscription ${id} deleted`,
    };
  }

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

  findReceivedWebhooks() {
    return this.receivedWebhooks;
  }

  clearReceivedWebhooks() {
    this.receivedWebhooks = [];

    return {
      message: 'Received webhooks cleared',
    };
  }

  private signPayload(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }
}
