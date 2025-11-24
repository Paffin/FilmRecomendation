import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async completeOnboarding(id: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { onboardingCompleted: true },
    });
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
