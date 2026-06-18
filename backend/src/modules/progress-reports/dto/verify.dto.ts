import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class VerifyDto {
  @IsNotEmpty({ message: '复核结果不能为空' })
  @IsBoolean()
  approved: boolean;

  @IsNotEmpty({ message: '复核意见不能为空' })
  @IsString()
  opinion: string;
}
