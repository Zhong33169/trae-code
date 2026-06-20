import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsOptional, IsIn } from 'class-validator';

export class GuestConfirmDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  @IsOptional()
  operatorRole?: string;

  @IsBoolean()
  confirmed!: boolean;

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;
}
