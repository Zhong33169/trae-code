import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsIn, IsOptional } from 'class-validator';

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
  @IsNotEmpty()
  expectedVersion!: number;
}
