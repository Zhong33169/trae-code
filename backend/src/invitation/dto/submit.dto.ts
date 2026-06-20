import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class SubmitDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;
}
