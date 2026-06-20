import { IsString, IsNotEmpty, IsIn, IsBoolean } from 'class-validator';

export class ReviewDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;

  @IsString()
  @IsNotEmpty()
  finalComment!: string;

  @IsBoolean()
  checkinCompleted!: boolean;
}
