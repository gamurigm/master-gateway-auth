import { IsUUID } from 'class-validator';

export class AssignUserDto {
  @IsUUID('4')
  userId!: string;
}
