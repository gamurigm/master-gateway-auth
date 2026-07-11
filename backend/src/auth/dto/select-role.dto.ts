import { IsString, IsUUID } from 'class-validator';

export class SelectRoleDto {
  @IsString()
  tempToken!: string;

  @IsUUID('4')
  roleId!: string;
}
