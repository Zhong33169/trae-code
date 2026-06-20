import { IsArray, IsString, IsIn, IsNotEmpty, ArrayNotEmpty, IsOptional, IsObject } from 'class-validator';

export class BatchActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsIn(['approve', 'reject', 'review', 'review-reject', 'reprocess'])
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

  @IsObject()
  @IsOptional()
  itemVersions?: Record<string, number>;
}
