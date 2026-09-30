import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'admin@simpleinvoice.dev' })
  email: string;

  @ApiProperty({ example: 'Demo Admin' })
  fullname: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 3600, description: 'Token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}
