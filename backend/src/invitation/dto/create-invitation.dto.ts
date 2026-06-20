import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateInvitationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsIn(['电视', '报纸', '网络', '自媒体', '其他'])
  mediaType!: string;

  @IsString()
  @IsNotEmpty()
  eventName!: string;

  @IsString()
  @IsNotEmpty()
  eventDate!: string;

  @IsString()
  @IsNotEmpty()
  eventLocation!: string;

  @IsString()
  @IsNotEmpty()
  deadline!: string;
}
