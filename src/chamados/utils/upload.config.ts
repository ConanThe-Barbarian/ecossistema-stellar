import { extname } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

const uploadPath = './uploads/chamados';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
      const fileName = randomUUID();
      const extension = extname(file.originalname).toLowerCase();
      cb(null, `${fileName}${extension}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const extensoesPermitidas = /jpeg|jpg|png|pdf|log|docx/;
    const mimetypesPermitidos = /image\/jpeg|image\/png|application\/pdf|text\/plain|application\/vnd.openxmlformats-officedocument.wordprocessingml.document/;

    const extName = extensoesPermitidas.test(extname(file.originalname).toLowerCase());
    const mimeType = mimetypesPermitidos.test(file.mimetype);

    if (extName && mimeType) {
      return cb(null, true);
    }

    cb(
      new HttpException(
        'Arquivo não suportado. A Stellar Syntec aceita apenas imagens (JPG/PNG), PDFs, DOCX ou arquivos de LOG.',
        HttpStatus.BAD_REQUEST,
      ),
      false,
    );
  },
};