// Khoá ký/xác minh access token; không có giá trị mặc định
// (khoá mặc định nằm trong code thì ai đọc code cũng tự ký được token hợp lệ)
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('Thiếu JWT_SECRET: Auth không thể ký hoặc xác minh token.');
  }
  return secret;
};
