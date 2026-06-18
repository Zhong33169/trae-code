import { IsNotEmpty, IsString } from 'class-validator';

export class HandleTimeoutDto {
  @IsNotEmpty({ message: '超时原因不能为空' })
  @IsString()
  timeoutReason: string;

  @IsNotEmpty({ message: '后续处理措施不能为空' })
  @IsString()
  timeoutFollowUp: string;

  @IsString()
  remarks?: string;
}
