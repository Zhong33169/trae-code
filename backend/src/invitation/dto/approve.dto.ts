import { IsString, IsNotEmpty, IsIn, IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class ApproveDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;

  @IsString()
  @IsNotEmpty()
  reviewComment!: string;

  @IsBoolean()
  guestConfirmed!: boolean;

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;
}
