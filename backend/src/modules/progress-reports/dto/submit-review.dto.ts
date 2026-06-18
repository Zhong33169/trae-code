import { IsOptional, IsString } from 'class-validator';

export class SubmitReviewDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
