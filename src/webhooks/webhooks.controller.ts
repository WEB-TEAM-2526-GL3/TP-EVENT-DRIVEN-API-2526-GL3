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
