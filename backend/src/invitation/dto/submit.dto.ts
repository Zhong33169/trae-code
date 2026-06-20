import { IsString, IsNotEmpty, IsIn, IsNumber, IsOptional } from 'class-validator';

export class SubmitDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;
}
