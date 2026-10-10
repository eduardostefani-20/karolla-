/**
 * Função agendada (Netlify Scheduled Function): a cada hora remove do banco e do Storage
 * os Stories cuja validade de 24h já passou.
 * A expiração em si não depende desta função: o site e o banco só mostram stories com
 * expires_at > agora. Esta rotina apenas apaga os arquivos vencidos.
 */
import { loadEnv } from '../../backend/src/config/env';
import { buildContainer } from '../../backend/src/container';

export default async () => {
  const container = await buildContainer(loadEnv());
  const removed = await container.media.purgeExpiredStories();
  console.log(JSON.stringify({ message: 'stories vencidos removidos', removed }));
};

// minuto 7 de cada hora (UTC)
export const config = { schedule: '7 * * * *' };
