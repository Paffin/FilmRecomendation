import { PartialType } from '@nestjs/mapped-types';
import { CreateUserTitleDto } from './create-user-title.dto';

export class UpdateUserTitleDto extends PartialType(CreateUserTitleDto) {}
