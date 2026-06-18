import { IsNotEmpty, IsString, IsEnum, IsOptional, IsPhoneNumber } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: '姓名不能为空' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  password: string;

  @IsNotEmpty({ message: '角色不能为空' })
  @IsEnum(Role, { message: '角色值不正确' })
  role: Role;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  phone?: string;
}
