import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';//donne-moi la version moderne de fs basée sur les Promises
import { randomUUID } from 'crypto';//avoid file name collision
import { extname, join } from 'path';

@Injectable()
export class FileStorageService {
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  async saveFile(
    file: Express.Multer.File,
    directory: string,
    options?: {
      allowedMimeTypes?: string[];
      allowedExtensions?: string[];
      kind?: string;
      signatureType?: 'pdf' | 'image';
    },
  ): Promise<string> {
    this.validateFile(file, options);

    const absoluteDirPath = join(this.uploadsDir, directory);
    await fs.mkdir(absoluteDirPath, { recursive: true });

    const safeExt = extname(file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${randomUUID()}${safeExt}`;
    const absolutePath = join(absoluteDirPath, fileName);

    await fs.writeFile(absolutePath, file.buffer);

    return join('uploads', directory, fileName).replace(/\\/g, '/');
  }
  async saveCvFile(file: Express.Multer.File): Promise<string> {
    return await this.saveFile(file, 'cv', {
      allowedMimeTypes: ['application/pdf'],
      allowedExtensions: ['.pdf'],
      kind: 'PDF',
      signatureType: 'pdf',
    });
  }

  async saveImageFile(file: Express.Multer.File): Promise<string> {
    return await this.saveFile(file, 'image', {
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      kind: 'image',
      signatureType: 'image',
    });
  }

  async deleteFileIfExists(relativePath: string): Promise<void> {
    const absolutePath = join(process.cwd(), relativePath);

    try {
      await fs.unlink(absolutePath);
    } catch {
      // Ignore missing files or fs errors to avoid blocking DB updates.
    }
  }

  private validateFile(
    file: Express.Multer.File,
    options?: {
      allowedMimeTypes?: string[];
      allowedExtensions?: string[];
      kind?: string;
      signatureType?: 'pdf' | 'image';
    },
  ): void {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File content is empty');
    }

    const extension = extname(file.originalname).toLowerCase();

    if (!extension) {
      throw new BadRequestException('File extension is required');
    }

    const allowedExtensions = options?.allowedExtensions ?? [];
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        `Unsupported ${options?.kind ?? 'file'} extension`,
      );
    }

    const allowedMimeTypes = options?.allowedMimeTypes ?? [];
    if (
      allowedMimeTypes.length > 0 &&
      !allowedMimeTypes.includes(file.mimetype.toLowerCase())
    ) {
      throw new BadRequestException(`Unsupported ${options?.kind ?? 'file'} type`);
    }

    if (options?.signatureType === 'pdf' && !this.hasPdfSignature(file.buffer)) {
      throw new BadRequestException('Invalid PDF file content');
    }

    if (
      options?.signatureType === 'image' &&
      !this.hasImageSignature(file.buffer)
    ) {
      throw new BadRequestException('Invalid image file content');
    }
  }

  private hasPdfSignature(buffer: Buffer): boolean {
    if (buffer.length < 5) return false;
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  private hasImageSignature(buffer: Buffer): boolean {
    return (
      this.hasPngSignature(buffer) ||
      this.hasJpegSignature(buffer) ||
      this.hasWebpSignature(buffer)
    );
  }

  private hasPngSignature(buffer: Buffer): boolean {
    if (buffer.length < 8) return false;
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return pngSignature.every((byte, index) => buffer[index] === byte);
  }

  private hasJpegSignature(buffer: Buffer): boolean {
    if (buffer.length < 3) return false;
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  private hasWebpSignature(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
}
