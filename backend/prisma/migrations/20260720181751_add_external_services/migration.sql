-- CreateTable
CREATE TABLE "servicios_externos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "base_url" TEXT NOT NULL,
    "health_path" TEXT NOT NULL DEFAULT '/health',
    "openapi_path" TEXT,
    "ultima_verificacion" TIMESTAMP(3),
    "ultima_verificacion_ok" BOOLEAN,
    "ultima_verificacion_ms" INTEGER,
    "modulo_id" UUID,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "creado_por" UUID,
    "actualizado_por" UUID,

    CONSTRAINT "servicios_externos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicios_externos_codigo_key" ON "servicios_externos"("codigo");

-- CreateIndex
CREATE INDEX "servicios_externos_modulo_id_idx" ON "servicios_externos"("modulo_id");

-- AddForeignKey
ALTER TABLE "servicios_externos" ADD CONSTRAINT "servicios_externos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
