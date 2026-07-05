import { IsString, IsUUID } from 'class-validator';

export class SelectRoleDto {
  @IsString()
  tempToken!: string;

  @IsUUID()
  roleId!: string;
}

