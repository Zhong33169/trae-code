import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class UpdateInvitationDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsIn(['电视', '报纸', '网络', '自媒体', '其他'])
  @IsOptional()
  mediaType?: string;

  @IsString()
  @IsOptional()
  eventName?: string;

  @IsString()
  @IsOptional()
  eventDate?: string;

  @IsString()
  @IsOptional()
  eventLocation?: string;

  @IsString()
  @IsOptional()
  deadline?: string;

  @IsBoolean()
  @IsOptional()
  guestConfirmed?: boolean;

  @IsBoolean()
  @IsOptional()
  checkinCompleted?: boolean;
}
