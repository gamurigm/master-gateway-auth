import { ConflictException, NotFoundException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ACTOR_ID = '22222222-2222-2222-2222-222222222222';
const EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Str0ng!Pass';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockUser = () => ({
    id: USER_ID,
    email: EMAIL,
    passwordHash: '$argon2id$somehash',
    firstName: 'Test',
    lastName: 'User',
    estado: Estado.ACTIVO,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: ACTOR_ID,
    updatedBy: null,
  });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    jest.clearAllMocks();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated active users without password', async () => {
      const user = mockUser();
      prisma.$transaction.mockResolvedValue([[user], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).not.toHaveProperty('passwordHash');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('returns user without password when found', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...mockUser(), roles: [] });

      const result = await service.findOne(USER_ID);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe(EMAIL);
    });

    it('throws NotFoundException when user is inactive or missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates and returns user without password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser());

      const result = await service.create(
        {
          email: EMAIL,
          firstName: 'Test',
          lastName: 'User',
          password: 'Str0ng!Pass',
        },
        ACTOR_ID,
      );

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe(EMAIL);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: EMAIL,
            firstName: 'Test',
            createdBy: ACTOR_ID,
          }),
        }),
      );
    });

    it('throws ConflictException when email exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());

      await expect(
        service.create(
          {
            email: EMAIL,
            firstName: 'Test',
            lastName: 'User',
            password: TEST_PASSWORD,
          },
          ACTOR_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('updates and returns user without password', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser());
      prisma.user.update.mockResolvedValue(mockUser());

      const result = await service.update(
        USER_ID,
        { firstName: 'Updated' },
        ACTOR_ID,
      );

      expect(result).not.toHaveProperty('passwordHash');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({ firstName: 'Updated' }),
        }),
      );
    });

    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, { firstName: 'Updated' }, ACTOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes the user', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser());
      prisma.user.update.mockResolvedValue({
        ...mockUser(),
        estado: Estado.INACTIVO,
      });

      const result = await service.remove(USER_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
    });

    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, ACTOR_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
