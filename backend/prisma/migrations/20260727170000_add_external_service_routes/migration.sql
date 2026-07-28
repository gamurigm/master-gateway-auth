-- CreateTable
CREATE TABLE "servicio_externo_rutas" (
    "id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "ruta_publica" TEXT NOT NULL,
    "ruta_destino" TEXT NOT NULL,
    "metodos" TEXT[] NOT NULL DEFAULT ARRAY['GET']::TEXT[],
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "creado_por" UUID,
    "actualizado_por" UUID,

    CONSTRAINT "servicio_externo_rutas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicio_externo_rutas_menu_id_key" ON "servicio_externo_rutas"("menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "servicio_externo_rutas_ruta_publica_key" ON "servicio_externo_rutas"("ruta_publica");

-- CreateIndex
CREATE INDEX "servicio_externo_rutas_servicio_id_idx" ON "servicio_externo_rutas"("servicio_id");

-- AddForeignKey
ALTER TABLE "servicio_externo_rutas" ADD CONSTRAINT "servicio_externo_rutas_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios_externos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio_externo_rutas" ADD CONSTRAINT "servicio_externo_rutas_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
