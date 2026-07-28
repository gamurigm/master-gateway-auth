-- Identidad de servicio (ADR-3): credencial con la que el Gateway se identifica
-- ANTE cada microservicio. Es distinta de INTERNAL_API_KEY, que es la clave
-- compartida con la que los hijos llaman al Master.
--
-- Nullable a proposito: un servicio sin clave configurada no recibe ninguna
-- cabecera de identidad de servicio (el proxy sigue enviando las de usuario).

-- AlterTable
ALTER TABLE "servicios_externos" ADD COLUMN     "api_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "servicios_externos_api_key_key" ON "servicios_externos"("api_key");
