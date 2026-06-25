import { extname } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

const uploadPath = './uploads/contratos';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

export const multerContratoConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadPath),
    filename: (_req, file, cb) => {
      const extension = extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB (contrato assinado pode ser maior)
  fileFilter: (_req: any, file: any, cb: any) => {
    const extOk = /pdf|jpeg|jpg|png|docx/.test(extname(file.originalname).toLowerCase());
    const mimeOk =
      /application\/pdf|image\/jpeg|image\/png|application\/vnd.openxmlformats-officedocument.wordprocessingml.document/.test(
        file.mimetype,
      );
    if (extOk && mimeOk) return cb(null, true);
    cb(
      new HttpException(
        'Formato não suportado para o contrato. Aceitos: PDF, DOCX, JPG ou PNG.',
        HttpStatus.BAD_REQUEST,
      ),
      false,
    );
  },
};
