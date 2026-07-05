import { IsUUID } from 'class-validator';

export class AssignModuleDto {
  @IsUUID()
  moduleId!: string;
}

