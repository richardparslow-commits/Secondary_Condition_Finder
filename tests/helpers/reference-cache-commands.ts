import { VA_SHARED_CACHE_CONDITIONAL_WRITE_SCRIPT } from "@/lib/va/reference-shared-cache";

export function referenceCacheWrites(commands: string[][]): { key: string; value: string }[] {
  return commands.flatMap((command) => {
    if (command[0] === "SET" && command[1]?.startsWith("va:ref:")) {
      return [{ key: command[1], value: command[2] }];
    }
    if (command[0] === "EVAL" && command[1] === VA_SHARED_CACHE_CONDITIONAL_WRITE_SCRIPT) {
      return [{ key: command[4], value: command[6] }];
    }
    return [];
  });
}

export function redisCommandKeys(command: string[]): string[] {
  if (command[0] === "EVAL") {
    return command.slice(3, 3 + Number(command[2]));
  }
  if (command[0] === "MGET" || command[0] === "DEL") return command.slice(1);
  if (["GET", "SET", "INCR", "INCRBY", "EXPIRE"].includes(command[0])) {
    return command.slice(1, 2);
  }
  return [];
}
