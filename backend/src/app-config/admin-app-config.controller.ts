import {
  Body,
  Controller,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AdminJwtAuthGuard } from '../admin-auth/admin-jwt-auth.guard';
import { AppConfigService } from './app-config.service';
import { UpdateAppConfigDto } from './dto/update-app-config.dto';

function safeExt(original: string) {
  const ext = path.extname(original || '').toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

@Controller('admin/app-config')
@UseGuards(AdminJwtAuthGuard)
export class AdminAppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Put()
  update(@Body() body: UpdateAppConfigDto) {
    return this.appConfig.updateConfig({
      primaryColor: body.primaryColor,
      logoUrl: body.logoUrl,
    });
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'public', 'uploads'),
        filename: (req, file, cb) => {
          const ext = safeExt(file.originalname);
          const name = `logo_${Date.now()}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (req, file, cb) => {
        const ok = /image\/(png|jpeg|jpg|webp)/.test(file.mimetype);
        if (!ok) return cb(new BadRequestException('Envie PNG/JPG/WEBP'), false);
        cb(null, true);
      },
    }),
  )
  async uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não recebido (campo "file")');

    // vai ser servido em /static/uploads/...
    const url = `/static/uploads/${file.filename}`;

    const cfg = await this.appConfig.setLogoUrl(url);

    return {
      ok: true,
      logoUrl: url,
      config: cfg,
    };
  }
}
