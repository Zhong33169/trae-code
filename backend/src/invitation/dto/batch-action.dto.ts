import { IsArray, IsString, IsIn, IsNotEmpty, ArrayNotEmpty, IsOptional } from 'class-validator';

export class BatchActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsIn(['approve', 'reject', 'review', 'review-reject'])
  action!: string;

  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsIn(['registrar', 'reviewer', 'final_reviewer'])
  operatorRole!: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
