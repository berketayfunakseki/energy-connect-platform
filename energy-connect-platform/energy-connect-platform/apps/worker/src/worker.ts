import { Repository } from "../../../packages/core/src/persistence/repository";
import { IntegrationService } from "../../../packages/core/src/services/integrationService";
import { metrics } from "../../../packages/core/src/observability/metrics";
import { logger } from "../../../packages/core/src/observability/logger";
import { sleep } from "../../../packages/core/src/util";

const repository = new Repository();
const service = new IntegrationService(repository);
const pollMs = Number(process.env.WORKER_POLL_MS ?? "1000");
let running = true;

async function loop(): Promise<void> {
  logger.info("worker started", { pollMs });
  while (running) {
    try {
      const backlog = await repository.queueBacklog();
      metrics.set("connect_command_queue_backlog", backlog);
      const command = await repository.claimNextCommand();
      if (!command) {
        await sleep(pollMs);
        continue;
      }
      logger.info("command claimed", { commandId: command.id, deviceId: command.deviceId, attemptCount: command.attemptCount });
      await service.executeCommand(command.id, command.deviceId, command.type);
    } catch (error) {
      logger.error("worker loop error", { error: String(error) });
      await sleep(Math.min(5000, pollMs * 2));
    }
  }
  await repository.close();
}

process.on("SIGTERM", () => { running = false; });
process.on("SIGINT", () => { running = false; });
void loop();
