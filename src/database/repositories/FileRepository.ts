import {File, FileUploadingInitialization} from '../model/File';
import {S3Client} from "../../utils/s3Client";
import {CompletedPart, CompleteMultipartUploadRequest, CreateMultipartUploadRequest} from "aws-sdk/clients/s3";
import {S3} from "aws-sdk";
import {ChunkIdETag, FinishUploadAllChunkDTO} from "../model/UploadChunk";
import {Op} from "sequelize";
import {Status} from "../../model/enum/Status";

const s3Client = new S3Client().initializeS3();

export class FileRepository {
    async findById(id: number): Promise<File> {
        return await File.findByPk(id);
    }

    async create(payload: FileUploadingInitialization): Promise<File> {
        return await File.create({
            folderId: payload.folderId, userId: payload.userId, name: payload.name,
            mimeType: payload.mimeType, size: payload.size, uploadStatus: payload.uploadStatus,
            createdAt: payload.createdAt, isDeleted: payload.isDeleted
        });
    }

    async updateFileUploadStatusWithId(fileId: number, newUploadStatus: string)
            : Promise<[affectedCount: number, affectedRows: File[]]> {
        return await File.update({
            uploadStatus: newUploadStatus,
            updatedAt: new Date()
        }, {returning: true, where: {id: fileId}});
    }

    async updateWithFileId(fileId: number, file: File): Promise<[affectedCount: number, affectedRows: File[]]> {
        return await File.update(file, { returning: true, where: { id: fileId } });
    }

    async getFilesWithFolderId(folderId: number | undefined, userId: number): Promise<File[]> {
        return await File.findAll({
            where: {
                folderId: folderId ?? 0,
                userId: userId,
                uploadStatus: Status.FINISHED.toString(),
                isDeleted: false
            }
        });
    }

    async getFilesWithKey(key: string, userId: number): Promise<File[]> {
        return await File.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${key}%`
                },
                userId: userId,
                uploadStatus: Status.FINISHED.toString(),
                isDeleted: false
            }
        })
    }


    /*
    * S3 Related-Queries
    */
    async getSingleUploadUrl(contentType: string, key: string): Promise<string> {
        const params = {
            Bucket: process.env.S3_BUCKET as string,
            Key: key,
            ContentType: contentType,
            Expires: process.env.S3_EXPIRES as number
        };

        try {
            return await s3Client.getSignedUrlPromise("putObject", params);
        } catch (error) {
            throw new Error(error);
        }
    }

    async initiateMultipartUploadS3(contentType: string, key: string): Promise<S3.Types.CreateMultipartUploadOutput> {
        const params: CreateMultipartUploadRequest = {
            Bucket: process.env.S3_BUCKET as string,
            Key: key,
            ContentType: contentType
        };

        try {
            return await s3Client.createMultipartUpload(params).promise();
        } catch (err) {
            console.error(err);
            throw new Error('Internal Server Error');
        }
    }

    async completeMultipartUploadS3(request: FinishUploadAllChunkDTO): Promise<S3.Types.CompleteMultipartUploadOutput> {
        try {
            const param: CompleteMultipartUploadRequest = {
                Bucket: process.env.S3_BUCKET as string,
                Key: request.fileId as string,
                UploadId: request.uploadId,
                MultipartUpload: {
                    Parts: this.generateCompletedParts(request.chunkIdETagList)
                }
            };

            return await s3Client.completeMultipartUpload(param).promise();
        } catch (error) {
            console.error(error);
            throw new Error('Internal Server Error');
        }
    }

    private generateCompletedParts(partList: ChunkIdETag[]): CompletedPart[] {
        const completedPartList: CompletedPart[] = [];
        for (let i = 0 ; i < partList.length; i++) {
            completedPartList.push({
                ETag: partList[i].eTag, PartNumber: partList[i].partNumber
            })
        }
        return completedPartList;
    }
}