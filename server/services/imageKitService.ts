import ImageKit from 'imagekit';
import { IMAGEKIT_CONFIG } from '../env-setup';

export interface ImageKitFile {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  filePath: string;
  fileType: string;
  size: number;
  height?: number;
  width?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImageKitFolder {
  name: string;
  path: string;
  type: 'folder';
}

export interface ImageKitUploadResult {
  success: boolean;
  file?: ImageKitFile;
  error?: string;
}

export interface ImageKitAuthParams {
  token: string;
  expire: number;
  signature: string;
}

export class ImageKitService {
  private imagekit: ImageKit;
  private publicKey: string;
  private privateKey: string;
  private urlEndpoint: string;

  constructor() {
    this.publicKey = IMAGEKIT_CONFIG.PUBLIC_KEY;
    this.privateKey = IMAGEKIT_CONFIG.PRIVATE_KEY;
    this.urlEndpoint = IMAGEKIT_CONFIG.URL_ENDPOINT;

    this.imagekit = new ImageKit({
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      urlEndpoint: this.urlEndpoint,
    });
  }

  // Get authentication parameters for client-side uploads
  getAuthParams(): ImageKitAuthParams {
    try {
      return this.imagekit.getAuthenticationParameters();
    } catch (error) {
      console.error('Error generating ImageKit auth params:', error);
      throw new Error('Failed to generate authentication parameters');
    }
  }

  // Upload a single file
  async uploadFile(file: Buffer | File, fileName: string, folder: string = '/'): Promise<ImageKitUploadResult> {
    try {
      return new Promise((resolve, reject) => {
        this.imagekit.upload(
          {
            file: file,
            fileName: fileName,
            folder: folder,
            useUniqueFileName: true,
            responseFields: ['fileId', 'name', 'url', 'thumbnailUrl', 'filePath', 'fileType', 'size', 'height', 'width', 'createdAt', 'updatedAt']
          },
          (error, result) => {
            if (error) {
              console.error('ImageKit upload error:', error);
              resolve({
                success: false,
                error: error.message || 'Upload failed'
              });
            } else if (result) {
              const fileData: ImageKitFile = {
                fileId: result.fileId,
                name: result.name,
                url: result.url,
                thumbnailUrl: result.thumbnailUrl,
                filePath: result.filePath,
                fileType: result.fileType,
                size: result.size,
                height: result.height,
                width: result.width,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
              };
              resolve({
                success: true,
                file: fileData
              });
            } else {
              resolve({
                success: false,
                error: 'Unknown upload error'
              });
            }
          }
        );
      });
    } catch (error) {
      console.error('Error in uploadFile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  // Upload multiple files
  async uploadMultipleFiles(files: Array<{ file: Buffer | File; fileName: string }>, folder: string = '/'): Promise<ImageKitUploadResult[]> {
    try {
      const uploadPromises = files.map(({ file, fileName }) => 
        this.uploadFile(file, fileName, folder)
      );
      
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error in uploadMultipleFiles:', error);
      throw new Error('Failed to upload multiple files');
    }
  }

  // Delete a file
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        this.imagekit.deleteFile(fileId, (error, result) => {
          if (error) {
            console.error('ImageKit delete error:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error in deleteFile:', error);
      return false;
    }
  }

  // Delete multiple files
  async deleteMultipleFiles(fileIds: string[]): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    try {
      const deletePromises = fileIds.map(fileId => this.deleteFile(fileId));
      const results = await Promise.allSettled(deletePromises);
      
      const deletedCount = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      const errors = results
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason);

      return {
        success: deletedCount > 0,
        deletedCount,
        errors
      };
    } catch (error) {
      console.error('Error in deleteMultipleFiles:', error);
      return {
        success: false,
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Create a folder (by uploading a .keep file)
  async createFolder(folderPath: string): Promise<boolean> {
    try {
      const keepFile = new Blob(['keep'], { type: 'text/plain' });
      const result = await this.uploadFile(keepFile as any, '.keep', folderPath);
      return result.success;
    } catch (error) {
      console.error('Error in createFolder:', error);
      return false;
    }
  }

  // List files in a folder
  async listFiles(folderPath: string = '/'): Promise<{ files: ImageKitFile[]; folders: ImageKitFolder[] }> {
    try {
      return new Promise((resolve, reject) => {
        this.imagekit.listFiles({
          path: folderPath,
          limit: 100,
          skip: 0
        }, (error, result) => {
          if (error) {
            console.error('ImageKit list files error:', error);
            resolve({ files: [], folders: [] });
          } else if (result) {
            const files: ImageKitFile[] = [];
            const folders: ImageKitFolder[] = [];

            result.forEach((item: any) => {
              if (item.fileType === 'folder') {
                folders.push({
                  name: item.name,
                  path: item.filePath,
                  type: 'folder'
                });
              } else {
                files.push({
                  fileId: item.fileId,
                  name: item.name,
                  url: item.url,
                  thumbnailUrl: item.thumbnailUrl,
                  filePath: item.filePath,
                  fileType: item.fileType,
                  size: item.size,
                  height: item.height,
                  width: item.width,
                  createdAt: item.createdAt,
                  updatedAt: item.updatedAt
                });
              }
            });

            resolve({ files, folders });
          } else {
            resolve({ files: [], folders: [] });
          }
        });
      });
    } catch (error) {
      console.error('Error in listFiles:', error);
      return { files: [], folders: [] };
    }
  }

  // Get file details
  async getFileDetails(fileId: string): Promise<ImageKitFile | null> {
    try {
      return new Promise((resolve, reject) => {
        this.imagekit.getFileDetails(fileId, (error, result) => {
          if (error) {
            console.error('ImageKit get file details error:', error);
            resolve(null);
          } else if (result) {
            const fileData: ImageKitFile = {
              fileId: result.fileId,
              name: result.name,
              url: result.url,
              thumbnailUrl: result.thumbnailUrl,
              filePath: result.filePath,
              fileType: result.fileType,
              size: result.size,
              height: result.height,
              width: result.width,
              createdAt: result.createdAt,
              updatedAt: result.updatedAt
            };
            resolve(fileData);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error in getFileDetails:', error);
      return null;
    }
  }

  // Generate URL with transformations
  generateUrl(filePath: string, transformations?: string): string {
    try {
      return this.imagekit.url({
        path: filePath,
        transformation: transformations ? [transformations] : undefined
      });
    } catch (error) {
      console.error('Error generating URL:', error);
      return '';
    }
  }

  // Validate file type
  validateFileType(fileName: string, allowedTypes: string[] = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt']): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  // Validate file size (in bytes)
  validateFileSize(fileSize: number, maxSize: number = 10 * 1024 * 1024): boolean { // Default 10MB
    return fileSize <= maxSize;
  }

  // Sanitize folder path
  sanitizeFolderPath(path: string): string {
    return path
      .replace(/^\/+/, '') // Remove leading slashes
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/[^a-zA-Z0-9\-_\/]/g, '') // Remove invalid characters
      .replace(/\/+/g, '/'); // Replace multiple slashes with single slash
  }

  // Sanitize file name
  sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9\-_.]/g, '') // Remove invalid characters
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\.+$/, ''); // Remove trailing dots
  }
}

// Export singleton instance
export const imageKitService = new ImageKitService(); 