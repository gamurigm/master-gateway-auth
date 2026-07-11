import { IsUUID } from 'class-validator';

export class AssignMenuDto {
  @IsUUID()
  menuId!: string;
}
