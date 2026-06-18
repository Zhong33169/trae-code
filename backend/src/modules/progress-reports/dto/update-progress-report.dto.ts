import { PartialType } from '@nestjs/swagger';
import { CreateProgressReportDto } from './create-progress-report.dto';

export class UpdateProgressReportDto extends PartialType(CreateProgressReportDto) {}
