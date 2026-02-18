import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../admin-auth/admin-jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';

@Controller('admin/users')
@UseGuards(AdminJwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.users.createUser(body);
  }
}
