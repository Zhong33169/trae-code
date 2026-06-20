import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CheckinFeedbackDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  @IsOptional()
  operatorRole?: string;

  @IsBoolean()
  completed!: boolean;

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;
}
