import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return service health', () => {
      expect(appController.health()).toMatchObject({
        status: 'ok',
        service: 'master-gateway',
      });
    });
  });

  describe('databaseHealth', () => {
    it('should return database health', async () => {
      await expect(appController.databaseHealth()).resolves.toMatchObject({
        status: 'ok',
        database: 'postgresql',
      });
    });
  });
});
