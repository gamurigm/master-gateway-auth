import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PolicyGuard } from './policy.guard';
import { PolicyService } from './policy.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PolicyService, PolicyGuard],
  exports: [PolicyService, PolicyGuard],
})
export class PolicyModule {}
