import { describe, expect, it } from 'vitest';
import { ShellExecError, shellExecAsync, shellExecSync } from '../../src/shell/shellExec.js';

// Dùng chính Node làm "chương trình bên ngoài" để test không phụ thuộc Python.
// `node -e "<code>"` chạy đoạn code JavaScript như một chương trình riêng.
const NODE = process.execPath;

const ECHO_STDIN_UPPERCASE = `let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(s.toUpperCase()))`;
const PRINT_FIRST_ARG = `process.stdout.write(process.argv[1])`;
const FAIL_WITH_CODE_3 = `process.stderr.write('Lỗi: thiếu mẫu');process.exit(3)`;
const sleep = (ms: number) => `setTimeout(()=>process.stdout.write('xong'),${ms})`;

// Chạy hàm và trả về lỗi nó ném ra, để test kiểm tra nội dung lỗi
const layLoi = async (run: () => unknown): Promise<unknown> => {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('Mong đợi có lỗi nhưng chương trình chạy thành công');
};

// Cùng một bộ test cho cả 2 hàm (bản sync được bọc async để dùng chung cách gọi)
describe.each([
  { name: 'shellExecSync (blocking)', run: async (...args: Parameters<typeof shellExecSync>) => shellExecSync(...args) },
  { name: 'shellExecAsync (non-blocking)', run: shellExecAsync },
])('$name', ({ run }) => {
  it('sends input on stdin and returns stdout', async () => {
    const result = await run(NODE, ['-e', ECHO_STDIN_UPPERCASE], { input: 'tuần 2' });

    expect(result).toEqual({ stdout: 'TUẦN 2', stderr: '' });
  });

  it('passes arguments as-is, never through a shell', async () => {
    const tricky = 'a" & echo HACKED; $(whoami) `id` | x';

    const result = await run(NODE, ['-e', PRINT_FIRST_ARG, tricky]);

    expect(result.stdout).toBe(tricky);
  });

  it('fails with the exit code and stderr when the program exits with an error', async () => {
    const error = await layLoi(() => run(NODE, ['-e', FAIL_WITH_CODE_3]));

    expect(error).toBeInstanceOf(ShellExecError);
    expect(error).toMatchObject({ reason: 'exit', exitCode: 3, stderr: 'Lỗi: thiếu mẫu' });
  });

  it('fails when the program cannot be started', async () => {
    const error = await layLoi(() => run('khong-co-chuong-trinh-nay', []));

    expect(error).toMatchObject({ name: 'ShellExecError', reason: 'start' });
  });

  it('stops the program and fails after the timeout', async () => {
    const started = Date.now();

    const error = await layLoi(() => run(NODE, ['-e', sleep(10_000)], { timeoutMs: 300 }));

    expect(error).toMatchObject({ name: 'ShellExecError', reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe('blocking vs non-blocking', () => {
  // Đếm số lần một bộ hẹn giờ 20 ms kịp chạy trong lúc chương trình con chạy ~400 ms.
  // Hẹn giờ chạy được nghĩa là server vẫn làm được việc khác.
  const countTicksWhile = async (run: () => unknown) => {
    let ticks = 0;
    const timer = setInterval(() => (ticks += 1), 20);
    await run();
    clearInterval(timer);
    return ticks;
  };

  it('shellExecSync freezes everything until the program ends', async () => {
    const ticks = await countTicksWhile(() => shellExecSync(NODE, ['-e', sleep(400)]));

    expect(ticks).toBe(0);
  });

  it('shellExecAsync lets the server keep working while the program runs', async () => {
    const ticks = await countTicksWhile(() => shellExecAsync(NODE, ['-e', sleep(400)]));

    expect(ticks).toBeGreaterThan(3);
  });
});
