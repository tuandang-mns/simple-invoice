import { ApiProperty } from '@nestjs/swagger';

/** Shape of every error response (spec §2.3.5 / §2.3.6). Used for Swagger docs. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['dueDate must be on or after invoiceDate'],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
