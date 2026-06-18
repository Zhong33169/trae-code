import { IsNotEmpty, IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateProgressReportDto {
  @IsNotEmpty({ message: '标题不能为空' })
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsNotEmpty({ message: '截止时间不能为空' })
  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsDateString()
  reportDate?: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  abnormalReason?: string;

  @IsOptional()
  @IsUUID()
  responsiblePersonId?: string;
}
