import { IsString, IsNotEmpty, IsIn } from 'class-validator';

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
}
