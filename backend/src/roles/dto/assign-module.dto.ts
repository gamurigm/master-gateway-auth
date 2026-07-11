import { IsUUID } from 'class-validator';

export class AssignModuleDto {
  @IsUUID('4')
  moduleId!: string;
}
