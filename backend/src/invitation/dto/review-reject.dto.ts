import { IsString, IsNotEmpty, IsIn, IsNumber } from 'class-validator';

export class ReviewRejectDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;

  @IsString()
  @IsNotEmpty()
  finalComment!: string;

  @IsNumber()
  @IsNotEmpty()
  expectedVersion!: number;
}
