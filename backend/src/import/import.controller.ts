import { Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ImportService } from './import.service';
import { ImportBatchStatus, ImportSource } from '../entities/import-batch.entity';
import { ImportRecordStatus } from '../entities/import-record.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('imports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post('upload')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: path.resolve(__dirname, '../../uploads'),
      filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
      },
    }),
  }))
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('source') source: string,
    @Body('remark') remark: string,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }
    return this.importService.importFromExcel(
      {
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
      },
      user,
      (source as ImportSource) || ImportSource.EXCEL,
      remark,
    );
  }

  @Get('batches')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REVIEWER)
  async findAllBatches(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status?: ImportBatchStatus,
    @Query('source') source?: ImportSource,
    @Query('keyword') keyword?: string,
  ) {
    return this.importService.findAllBatches({
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      status,
      source,
      keyword,
    });
  }

  @Get('batches/:id')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REVIEWER)
  async findBatch(@Param('id') id: string) {
    return this.importService.findBatch(id);
  }

  @Get('batches/:id/records')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REVIEWER)
  async findBatchRecords(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status?: ImportRecordStatus,
  ) {
    return this.importService.findBatchRecords(id, {
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 50,
      status,
    });
  }

  @Get('records/:id')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REVIEWER)
  async findRecord(@Param('id') id: string) {
    return this.importService.findRecord(id);
  }

  @Post('records/:id/retry')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async retryRecord(@Param('id') id: string, @CurrentUser() user: User) {
    return this.importService.retryFailedRecord(id, user);
  }

  @Post('batches/:batchId/process')
  @Roles(UserRole.SUPERVISOR)
  async processBatch(@Param('batchId') batchId: string, @CurrentUser() user: User) {
    return this.importService.processBatch(batchId, user);
  }

  @Get('statistics/summary')
  @Roles(UserRole.SUPERVISOR, UserRole.REVIEWER)
  async getStatistics() {
    return this.importService.getStatistics();
  }
}
