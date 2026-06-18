import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsArray, ArrayNotEmpty } from 'class-validator';
import { RiskLevel, UserRole, ReviewStatus } from './review.types';

export class RegisterReviewDto {
  @IsString()
  @IsNotEmpty()
  customer_name: string;

  @IsString()
  @IsNotEmpty()
  trade_type: string;

  @IsNumber()
  @IsNotEmpty()
  trade_amount: number;

  @IsString()
  @IsNotEmpty()
  trade_date: string;

  @IsString()
  @IsNotEmpty()
  account_no: string;

  @IsEnum(RiskLevel)
  @IsNotEmpty()
  risk_level: RiskLevel;

  @IsString()
  @IsNotEmpty()
  created_by: string;

  @IsArray()
  @IsOptional()
  evidence?: string[];

  @IsString()
  @IsOptional()
  deadline?: string;
}

export class ProcessReviewDto {
  @IsString()
  @IsNotEmpty()
  review_id: string;

  @IsString()
  @IsNotEmpty()
  operator_id: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  operator_role: UserRole;

  @IsNumber()
  @IsNotEmpty()
  expected_version: number;

  @IsArray()
  @IsOptional()
  evidence?: string[];

  @IsString()
  @IsOptional()
  opinion?: string;

  @IsString()
  @IsOptional()
  result?: string;
}

export class QueryReviewsDto {
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  @IsEnum(RiskLevel)
  @IsOptional()
  risk_level?: RiskLevel;

  @IsEnum(UserRole)
  @IsOptional()
  current_role?: UserRole;

  @IsString()
  @IsOptional()
  handler_id?: string;

  @IsString()
  @IsOptional()
  keyword?: string;
}
