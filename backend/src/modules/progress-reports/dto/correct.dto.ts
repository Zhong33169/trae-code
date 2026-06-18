import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CorrectDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  abnormalReason?: string;

  @IsNotEmpty({ message: '补正说明不能为空' })
  @IsString()
  correctionRemark: string;
}
