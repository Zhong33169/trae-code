import { IsString, IsEnum, IsOptional, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { TreatmentPlanStatus, UrgencyLevel } from '../../common/types';

export class CreateTreatmentPlanDto {
  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsString()
  @IsNotEmpty()
  patientPhone: string;

  @IsString()
  @IsNotEmpty()
  store: string;

  @IsString()
  @IsNotEmpty()
  deadline: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsOptional()
  materials?: any[];

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class UpdateTreatmentPlanDto {
  @IsString()
  @IsOptional()
  patientName?: string;

  @IsString()
  @IsOptional()
  patientPhone?: string;

  @IsString()
  @IsOptional()
  deadline?: string;

  @IsArray()
  @IsOptional()
  materials?: any[];

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsNumber()
  @IsOptional()
  version?: number;
}

export class QueryTreatmentPlanDto {
  @IsEnum(TreatmentPlanStatus)
  @IsOptional()
  status?: TreatmentPlanStatus;

  @IsEnum(UrgencyLevel)
  @IsOptional()
  urgency?: UrgencyLevel;

  @IsString()
  @IsOptional()
  store?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  keyword?: string;
}

export class SubmitVerificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @IsNotEmpty()
  version: number;
}

export class VerifyTreatmentPlanDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  result: 'pass' | 'reject';

  @IsString()
  @IsOptional()
  opinion?: string;

  @IsString()
  @IsOptional()
  rejectReason?: string;

  @IsArray()
  @IsOptional()
  verifiedMaterials?: string[];

  @IsNumber()
  @IsNotEmpty()
  version: number;
}

export class SubmitReviewDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @IsNotEmpty()
  version: number;
}

export class ReviewTreatmentPlanDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  result: 'pass' | 'reject';

  @IsString()
  @IsOptional()
  opinion?: string;

  @IsString()
  @IsOptional()
  rejectReason?: string;

  @IsNumber()
  @IsNotEmpty()
  version: number;
}

export class BatchOperationDto {
  @IsArray()
  @IsNotEmpty()
  planIds: string[];

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class AddAttachmentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}
