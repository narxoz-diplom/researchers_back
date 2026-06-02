import { ApiProperty } from '@nestjs/swagger';

export class LocalUploadResponseDto {
  @ApiProperty()
  public_id: string;

  @ApiProperty({ description: 'Public URL to display the uploaded file' })
  secure_url: string;

  @ApiProperty()
  bytes: number;

  @ApiProperty({ required: false })
  format?: string;

  @ApiProperty({ required: false })
  resource_type?: string;
}
