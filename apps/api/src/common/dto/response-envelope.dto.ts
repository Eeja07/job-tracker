import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseEnvelope<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;

  data!: T;
}

export class ApiErrorDetails {
  @ApiProperty({ example: 'RESOURCE_NOT_FOUND' })
  code!: string;

  @ApiProperty({
    example: 'The requested application ID app_123 was not found.',
    nullable: true,
  })
  details?: unknown;
}

export class ApiErrorEnvelope {
  @ApiProperty({ example: false })
  success!: boolean;

  @ApiProperty({ example: 'Resource not found' })
  message!: string;

  @ApiProperty({ type: ApiErrorDetails })
  error!: ApiErrorDetails;
}
