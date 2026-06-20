import { IsString, IsNotEmpty, IsIn, IsNumber } from 'class-validator';

export class RejectDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;

  @IsString()
  @IsNotEmpty()
  reviewComment!: string;

  @IsNumber()
  @IsNotEmpty()
  expectedVersion!: number;
}
