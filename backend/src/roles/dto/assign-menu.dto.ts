import { IsUUID } from 'class-validator';

export class AssignMenuDto {
  @IsUUID('4')
  menuId!: string;
}
