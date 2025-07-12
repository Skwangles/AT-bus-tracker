import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Interface for R2 configuration
 */
export interface R2Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const Resolution = {width: 4096, height: 2048}

/**
 * Resolution levels for image processing
 */
export const RESOLUTION_LEVELS = {
  preview: { quality: 5, resolution: Resolution},
  lowest: { quality: 10, resolution: Resolution},
  low: { quality: 20, resolution: Resolution},
  medium: { quality: 60, resolution: Resolution},
  high: { quality: 80, resolution: Resolution},
  ultra: { quality: 100, resolution: Resolution},
} as const;

export type ResolutionLevel = keyof typeof RESOLUTION_LEVELS;

/**
 * CloudFlare R2 client wrapper using S3 compatibility API
 */
export class R2Client {
  private client: S3Client;
  private config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for R2 compatibility
    });
  }

  /**
   * Upload a file to R2 bucket
   * @param localFilePath - Path to the local file
   * @param remoteKey - Key (path) in the R2 bucket
   * @returns Promise that resolves when upload is complete
   */
  async uploadFile(localFilePath: string, remoteKey: string): Promise<void> {
    try {
      const fileContent = fs.readFileSync(localFilePath);
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteKey,
        Body: fileContent,
        ContentType: this.getContentType(localFilePath),
      });

      await this.client.send(command);
      console.log(`Successfully uploaded ${localFilePath} to R2 as ${remoteKey}`);
    } catch (error) {
      console.error(`Failed to upload ${localFilePath} to R2:`, error);
      throw error;
    }
  }

  /**
   * Upload multiple resolution versions of an image to R2
   * @param localFilePath - Path to the local image file
   * @param timestamp - Timestamp for the image (used in filename)
   * @param imageExtension - File extension (e.g., .png, .jpg)
   * @returns Promise that resolves when all uploads are complete
   */
  async uploadImageResolutions(localFilePath: string, timestamp: string, imageExtension: string): Promise<void> {
    try {
      const uploadPromises: Promise<void>[] = [];

      for (const [quality, settings] of Object.entries(RESOLUTION_LEVELS)) {
        const remoteKey = `${timestamp}-${quality}.jpg`;
        
        // Check if file already exists
        const exists = await this.fileExists(remoteKey);
        if (exists) {
          console.log(`File ${remoteKey} already exists in R2, skipping upload`);
          continue;
        }

        // Create resized image buffer
        const resizedBuffer = await this.createResizedImage(localFilePath, settings.resolution, settings.quality);
        
        // Upload the resized image
        const uploadPromise = this.uploadBuffer(resizedBuffer, remoteKey, this.getContentType(localFilePath));
        uploadPromises.push(uploadPromise);
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);
      console.log(`Successfully uploaded all resolution versions for ${timestamp}`);
    } catch (error) {
      console.error(`Failed to upload image resolutions for ${timestamp}:`, error);
      throw error;
    }
  }

  /**
   * Create a resized version of an image
   * @param localFilePath - Path to the source image
   * @param dimensions - Target dimensions
   * @param quality - Quality level for JPEG compression
   * @returns Promise that resolves to the resized image buffer
   */
  private async createResizedImage(
    localFilePath: string, 
    dimensions: { width: number; height: number }, 
    quality: number
  ): Promise<Buffer> {
    const { width, height } = dimensions;
    
    return sharp(localFilePath)
      .resize(width, height, {
        fit: "fill",
        withoutEnlargement: true,
      })
      .jpeg({ quality: quality })
      .toBuffer();
  }

  /**
   * Upload a buffer to R2 bucket
   * @param buffer - Image buffer to upload
   * @param remoteKey - Key (path) in the R2 bucket
   * @param contentType - MIME content type
   * @returns Promise that resolves when upload is complete
   */
  private async uploadBuffer(buffer: Buffer, remoteKey: string, contentType: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteKey,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);
      console.log(`Successfully uploaded buffer to R2 as ${remoteKey}`);
    } catch (error) {
      console.error(`Failed to upload buffer to R2 as ${remoteKey}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in R2 bucket
   * @param remoteKey - Key (path) in the R2 bucket
   * @returns Promise that resolves to true if file exists, false otherwise
   */
  async fileExists(remoteKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteKey,
      });
      await this.client.send(command);
      console.log("File exists in R2", remoteKey)
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log("File does not exist in R2", remoteKey)
        return false;
      }
      throw error;
    }
  }

  /**
   * Upload file only if it doesn't already exist in R2
   * @param localFilePath - Path to the local file
   * @param remoteKey - Key (path) in the R2 bucket
   * @returns Promise that resolves to true if uploaded, false if already exists
   */
  async uploadFileIfNotExists(localFilePath: string, remoteKey: string): Promise<boolean> {
    const exists = await this.fileExists(remoteKey);
    if (exists) {
      console.log(`File ${remoteKey} already exists in R2, skipping upload`);
      return false;
    }

    await this.uploadFile(localFilePath, remoteKey);
    return true;
  }

  /**
   * Get content type based on file extension
   * @param filePath - Path to the file
   * @returns MIME content type
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
} 