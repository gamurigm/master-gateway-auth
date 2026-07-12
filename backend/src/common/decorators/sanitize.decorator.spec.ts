import { plainToInstance } from 'class-transformer';
import { Sanitize } from './sanitize.decorator';

class TestDto {
  @Sanitize()
  value!: string;
}

describe('Sanitize', () => {
  it('preserves valid email characters', () => {
    const dto = plainToInstance(TestDto, {
      value: ' admin@example.com ',
    });

    expect(dto.value).toBe('admin@example.com');
  });

  it('removes html tags and control characters without stripping letters', () => {
    const dto = plainToInstance(TestDto, {
      value: '<b>Administracion</b>\nroles\tactivos',
    });

    expect(dto.value).toBe('Administracion roles activos');
  });
});
