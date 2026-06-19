import { Module, NestModule, MiddlewareConsumer, RequestMethod, OnModuleInit } from '@nestjs/common';
import { AuthMiddleware } from './auth.middleware';
import { UserService } from './user.service';
import { AuthController, UserController } from './user.controller';
import { HarvestService } from './harvest.service';
import { HarvestController } from './harvest.controller';

@Module({
  imports: [],
  controllers: [AuthController, UserController, HarvestController],
  providers: [UserService, HarvestService],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    private readonly userService: UserService,
    private readonly harvestService: HarvestService
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/me', method: RequestMethod.GET }
      )
      .forRoutes('*');
  }

  onModuleInit() {
    this.userService.initDemoUsers();
    const admin = this.userService.findByUsername('admin1');
    if (admin) {
      this.harvestService.initDemoData(admin.id);
    }
  }
}
