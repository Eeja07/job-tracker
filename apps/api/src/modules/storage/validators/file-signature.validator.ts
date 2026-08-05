import { BadRequestException } from '@nestjs/common';

export interface FileSignatureCheck {
  allowedMimes: string[];
  allowedExtensions: string[];
}

export class FileSignatureValidator {
  private static readonly MAGIC_BYTES: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    'image/jpeg': [
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
      [0xff, 0xd8, 0xff, 0xe2],
      [0xff, 0xd8, 0xff, 0xe8],
      [0xff, 0xd8, 0xff, 0xee],
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      [0x50, 0x4b, 0x03, 0x04], // PK.. (Zip signature for docx)
    ],
    'image/webp': [
      [0x52, 0x49, 0x46, 0x46], // RIFF
    ],
  };

  private static readonly EXECUTABLE_MAGIC_BYTES = [
    [0x4d, 0x5a], // MZ (DOS/Windows Executable)
    [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux Binary)
    [0xca, 0xfe, 0xba, 0xbe], // Mach-O / Java Class
    [0xce, 0xfa, 0xed, 0xfe], // Mach-O
  ];

  public static validate(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    allowedMimes: string[],
  ): void {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty file buffer provided');
    }

    // 1. MIME check
    if (!allowedMimes.includes(mimeType)) {
      throw new BadRequestException(
        `Disallowed MIME type '${mimeType}'. Allowed: ${allowedMimes.join(', ')}`,
      );
    }

    // 2. Extension check
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) {
      throw new BadRequestException('File missing extension');
    }

    // 3. Executable magic byte rejection
    for (const signature of this.EXECUTABLE_MAGIC_BYTES) {
      if (this.matchSignature(buffer, signature)) {
        throw new BadRequestException(
          'Security threat: Executable file signature detected',
        );
      }
    }

    // 4. Specific magic byte validation
    const expectedSignatures = this.MAGIC_BYTES[mimeType];
    if (expectedSignatures && expectedSignatures.length > 0) {
      const matched = expectedSignatures.some((sig) =>
        this.matchSignature(buffer, sig),
      );
      if (!matched) {
        throw new BadRequestException(
          `File magic bytes signature mismatch for declared MIME type '${mimeType}'`,
        );
      }
    }
  }

  private static matchSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }
}
