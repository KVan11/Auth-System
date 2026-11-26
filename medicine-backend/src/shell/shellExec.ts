import { spawn, spawnSync } from 'node:child_process';

// Chạy chương trình bên ngoài. Tham số truyền dạng mảng, không qua shell nên không bị chèn lệnh.

export interface ShellExecOptions {
  input?: string; // ghi vào stdin
  timeoutMs?: number; // mặc định 60 giây
}

export interface ShellExecResult {
  stdout: string;
  stderr: string;
}

// start: không chạy được, timeout: quá giờ, exit: mã thoát khác 0
export type ShellExecFailure = 'start' | 'timeout' | 'exit';

export class ShellExecError extends Error {
  override name = 'ShellExecError';
  reason: ShellExecFailure;
  exitCode: number | null;
  stderr: string;

  constructor(reason: ShellExecFailure, command: string, exitCode: number | null, stderr: string, cause?: unknown) {
    super(`${command} thất bại (${reason}): ${stderr.trim()}`, { cause });
    this.reason = reason;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

// Blocking: server đứng chờ, chỉ dùng trong script/test
export const shellExecSync = (command: string, args: string[], options: ShellExecOptions = {}): ShellExecResult => {
  const result = spawnSync(command, args, {
    input: options.input,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    encoding: 'utf8',
    windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  if (result.error) {
    const timedOut = (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
    throw new ShellExecError(timedOut ? 'timeout' : 'start', command, null, stderr, result.error);
  }
  if (result.status !== 0) {
    throw new ShellExecError('exit', command, result.status, stderr);
  }
  return { stdout, stderr };
};

// Non-blocking: dùng trong route HTTP
export const shellExecAsync = (
  command: string,
  args: string[],
  options: ShellExecOptions = {}
): Promise<ShellExecResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text: string) => {
      stdout += text;
    });
    child.stderr.on('data', (text: string) => {
      stderr += text;
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    // Không chạy được thì Node báo 'error' rồi vẫn báo 'close'
    let startError: Error | undefined;
    child.on('error', (error) => {
      startError = error;
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (startError) {
        reject(new ShellExecError('start', command, null, stderr, startError));
      } else if (timedOut) {
        reject(new ShellExecError('timeout', command, null, stderr));
      } else if (exitCode !== 0) {
        reject(new ShellExecError('exit', command, exitCode, stderr));
      } else {
        resolve({ stdout, stderr });
      }
    });

    // Chương trình thoát trước khi đọc hết stdin thì bỏ qua lỗi ghi
    child.stdin.on('error', () => {});
    child.stdin.end(options.input);
  });
