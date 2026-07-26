import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalProxyController } from './internal-proxy.controller';
import { InternalProxyService } from './internal-proxy.service';

@Module({
  imports: [ConfigModule],
  controllers: [InternalProxyController],
  providers: [InternalProxyService],
  exports: [InternalProxyService],
})
export class InternalProxyModule {}
