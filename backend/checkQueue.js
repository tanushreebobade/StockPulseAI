import { Queue } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const redisOptions = {
  maxRetriesPerRequest: null,
};

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (redisUrl.startsWith('rediss://')) {
  redisOptions.tls = {
    rejectUnauthorized: false
  };
}

const connection = new Redis(redisUrl, redisOptions);
const queue = new Queue("news_analysis_queue", { connection });

async function check() {
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const completed = await queue.getCompletedCount();
  const failed = await queue.getFailedCount();
  const delayed = await queue.getDelayedCount();
  
  console.log(`\n📬 BullMQ Queue Status ("news_analysis_queue"):`);
  console.log(`- Waiting: ${waiting}`);
  console.log(`- Active: ${active}`);
  console.log(`- Completed: ${completed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Delayed: ${delayed}`);
  
  process.exit(0);
}

check();
