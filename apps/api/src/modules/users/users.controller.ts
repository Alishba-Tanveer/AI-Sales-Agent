import type { Request, Response, NextFunction } from "express";
import { UsersService } from "./users.service";
import { updateProfileSchema, deleteAccountSchema } from "./users.schema";
import { AppError } from "../../utils/app-error";

function parseMultipartFile(
  rawBuffer: Buffer,
  contentTypeHeader: string
): { mimeType: string; buffer: Buffer } | null {
  const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) return null;

  const boundaryBytes = Buffer.from(`--${boundary}`);
  const headerEndMarker = Buffer.from("\r\n\r\n");

  let start = rawBuffer.indexOf(boundaryBytes);
  while (start !== -1) {
    start += boundaryBytes.length;
    if (rawBuffer.subarray(start, start + 2).toString() === "--") break;
    if (rawBuffer.subarray(start, start + 2).toString() === "\r\n") start += 2;

    const nextBoundary = rawBuffer.indexOf(boundaryBytes, start);
    if (nextBoundary === -1) break;

    const part = rawBuffer.subarray(start, nextBoundary - 2); // strip trailing \r\n
    const headerEnd = part.indexOf(headerEndMarker);
    if (headerEnd !== -1) {
      const headersText = part.subarray(0, headerEnd).toString("utf8");
      const contentTypeMatch = headersText.match(/Content-Type:\s*([^\r\n;]+)/i);
      if (contentTypeMatch) {
        const mimeType = contentTypeMatch[1].trim().toLowerCase();
        const fileBuffer = part.subarray(headerEnd + 4);
        return { mimeType, buffer: fileBuffer };
      }
    }
    start = nextBoundary;
  }
  return null;
}

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.usersService.getMe(req.user.userId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const data = await this.usersService.updateMe(req.user.userId, parseResult.data);
      res.status(200).json({
        message: "Profile saved",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }

      const contentType = req.headers["content-type"] || "";

      // Support JSON base64 data URL (e.g. { "avatar": "data:image/png;base64,..." })
      if (contentType.includes("application/json")) {
        const rawDataUrl: string | undefined = req.body?.avatar || req.body?.avatarUrl || req.body?.photo;
        if (!rawDataUrl || typeof rawDataUrl !== "string") {
          throw new AppError("Provide an image file (multipart/form-data) or base64 data URL in 'avatar'", 400);
        }
        const match = rawDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
        if (!match) {
          throw new AppError("Use a JPG, PNG or WEBP image.", 400);
        }
        const mimeType = match[1].toLowerCase();
        const buffer = Buffer.from(match[2], "base64");
        const data = await this.usersService.uploadAvatar(req.user.userId, mimeType, buffer);
        res.status(200).json({ message: "Photo uploaded successfully", data });
        return;
      }

      // Support multipart/form-data file upload (Postman form-data / browser FormData)
      if (contentType.includes("multipart/form-data")) {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const maxStreamBytes = 3 * 1024 * 1024; // 3MB stream guard

        await new Promise<void>((resolve, reject) => {
          req.on("data", (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes > maxStreamBytes) {
              reject(new AppError("Image is larger than 2MB.", 400));
              return;
            }
            chunks.push(chunk);
          });
          req.on("end", () => resolve());
          req.on("error", (err) => reject(err));
        });

        const rawBuffer = Buffer.concat(chunks);
        const parsed = parseMultipartFile(rawBuffer, contentType);
        if (!parsed || parsed.buffer.length === 0) {
          throw new AppError("No image file found in multipart form-data", 400);
        }

        const data = await this.usersService.uploadAvatar(
          req.user.userId,
          parsed.mimeType,
          parsed.buffer
        );
        res.status(200).json({ message: "Photo uploaded successfully", data });
        return;
      }

      throw new AppError(
        "Send multipart/form-data with an image file or application/json with a base64 data URL",
        400
      );
    } catch (err) {
      next(err);
    }
  };

  removeAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.usersService.removeAvatar(req.user.userId);
      res.status(200).json({
        message: "Photo removed",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = deleteAccountSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const result = await this.usersService.deleteMe(
        req.user.userId,
        parseResult.data,
        req.token
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
