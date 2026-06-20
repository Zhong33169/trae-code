import { IsArray, IsString, IsIn, IsNotEmpty, ArrayNotEmpty, IsObject, IsOptional } from 'class-validator';

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
  @IsNotEmpty()
  itemVersions!: Record<string, number>;
}
