import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/transform.util';

export class LoginDto {
  @ApiProperty({ example: 'admin@simpleinvoice.dev' })
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MaxLength(128)
  password: string;
}
