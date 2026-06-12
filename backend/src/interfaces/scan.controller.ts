import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ScanService } from '../application/scan.service';
import { OrderService } from '../application/order.service';
import { OrderAction, OrderStatus, Role } from '../types';

@Controller('api/scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post('validate')
  async validateQrCode(
    @Body() body: { qrCode: string },
    @Headers('x-operator-id') operatorId: string,
  ) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    if (!body.qrCode) {
      throw new BadRequestException('缺少二维码');
    }
    return this.scanService.validateQrCode(body.qrCode, operatorId);
  }

  @Post('scan')
  async scanQrCode(
    @Body() body: { qrCode: string },
    @Headers('x-operator-id') operatorId: string,
  ) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    if (!body.qrCode) {
      throw new BadRequestException('缺少二维码');
    }
    return this.scanService.scanQrCode(body.qrCode, operatorId);
  }
}
