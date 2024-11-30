import sharp from 'sharp'
import { Response } from 'express';

export const processImage = async (res: Response<any>, path: string, width: number | sharp.ResizeOptions | null | undefined) => {
  try {
    const image = sharp(path);
    let buffer;
    if (width == -1) {
      buffer = await image.toBuffer();
    } else {
      buffer = await image.resize(width).toBuffer();
    }

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).send('Error processing image');
    }
  }
};