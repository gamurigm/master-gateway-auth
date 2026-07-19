-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT,
    "delegable" BOOLEAN NOT NULL DEFAULT true,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "creado_por" UUID,
    "actualizado_por" UUID,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "creado_por" UUID,
    "actualizado_por" UUID,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_recurso_idx" ON "permisos"("recurso");

-- CreateIndex
CREATE INDEX "permisos_accion_idx" ON "permisos"("accion");

-- CreateIndex
CREATE UNIQUE INDEX "rol_permisos_rol_id_permiso_id_key" ON "rol_permisos"("rol_id", "permiso_id");

-- CreateIndex
CREATE INDEX "rol_permisos_permiso_id_idx" ON "rol_permisos"("permiso_id");

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
