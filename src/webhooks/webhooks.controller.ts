import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent } from '../enums/webhook-event.enum';
import { RoleGuard } from '../auth/role.guard';
import { RoleEnum } from '../enums/role.enum';

@Controller('webhooks')
@ApiTags('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('register')
  @UseGuards(AuthGuard('jwt'), RoleGuard(RoleEnum.ADMIN))
  @ApiBearerAuth()
  register(
    @Body()
    body: {
      url: string;
      event: WebhookEvent;
      secret?: string;
    },
  ) {
    return this.webhooksService.createSubscription(body);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RoleGuard(RoleEnum.ADMIN))
  @ApiBearerAuth()
  findAll() {
    return this.webhooksService.findAll();
  }

  @Get('received')
  findReceivedWebhooks() {
    return this.webhooksService.findReceivedWebhooks();
  }

  @Delete('received')
  clearReceivedWebhooks() {
    return this.webhooksService.clearReceivedWebhooks();
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RoleGuard(RoleEnum.ADMIN))
  @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.webhooksService.deleteSubscription(id);
  }

  @Post('test/:event')
  @UseGuards(AuthGuard('jwt'), RoleGuard(RoleEnum.ADMIN))
  @ApiBearerAuth()
  testDispatch(
    @Param('event') event: WebhookEvent,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooksService.dispatch(event, {
      test: true,
      ...body,
    });
  }

  // http://amr-app.com/cv-notifications
  @Post('test-receiver')
  testReceiver(
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooksService.saveReceivedWebhook({
      event: headers['x-cvtech-event'],
      signature: headers['x-cvtech-signature'],
      body,
    });
  }
}

// Simple flow:
// Admin registers webhook
// POST /webhooks/register

// CV is created or admin triggers test
// POST /webhooks/test/cv.created
// Webhook is sent to
// POST /webhooks/test-receiver
// You view received webhook
// GET /webhooks/received

// POST /webhooks/register HTTP/1.1
// Host: localhost:3000
// Content-Type: application/json
// Authorization: Bearer ADMIN_TOKEN
// {
//   "url": "http://amr-app.com/cv-notifications",
//   "event": "cv.created",
//   "secret": "amr-secret"
// }
// --it sends a POST request to Amr’s URL--
