import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    // 🚀 Mudamos para o formato URI: sqlserver://USER:PASS@HOST:PORT?database=DB&params...
    url: "sqlserver://sa:sasmghsa@26.114.17.175:1433?database=StellarSyntecDB&encrypt=true&trustServerCertificate=true",
  },
});