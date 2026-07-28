-- AlterTable
ALTER TABLE "servicios_externos" ADD COLUMN     "estado_salud" TEXT DEFAULT 'UNKNOWN',
ADD COLUMN     "metadata_endpoint" TEXT,
ADD COLUMN     "tipo" TEXT DEFAULT 'NATIVE',
ADD COLUMN     "tipo_autenticacion" TEXT DEFAULT 'JWT',
ADD COLUMN     "ultima_sincronizacion" TIMESTAMP(3),
ADD COLUMN     "version" TEXT;
