import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class ReviewDto {
  @IsNotEmpty({ message: '审核结果不能为空' })
  @IsBoolean()
  approved: boolean;

  @IsNotEmpty({ message: '审核意见不能为空' })
  @IsString()
  opinion: string;
}
