import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class GuestConfirmDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsBoolean()
  confirmed!: boolean;
}
