import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class CheckinFeedbackDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsBoolean()
  completed!: boolean;
}
