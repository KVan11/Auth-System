import * as bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
import { issueTokens } from "./token.service.js";

export { prisma };

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const toUserResponse = (user: any) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role.role_name,
  permissions: user.role.permissions.map((p: any) => p.permission_name),
});

// Mọi phương thức đăng nhập thành công đều đi qua đây để nhận access + refresh token
const buildLoginResult = async (user: any) => {
  const { accessToken, refreshToken } = await issueTokens(user);

  return {
    accessToken,
    refreshToken,
    token: accessToken, // alias tương thích ngược, sẽ bỏ sau
    user: toUserResponse(user),
  };
};

export const getCurrentUser = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: true
        }
      }
    }
  });

  if (!user) throw new Error('Người dùng không tồn tại');

  return toUserResponse(user);
};

export const registerUser = async (userData: any) => {
  if (!userData?.email || !userData?.username || !userData?.password) {
    throw new Error('Thiếu email, username hoặc password');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error('Email đã được sử dụng');
  }

  // 1. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  // 2. Lưu vào DB (Giả sử bạn đã có bảng User trong schema.prisma)
  try {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        password: hashedPassword,
        role_id: 2
      },
      select: {
        id: true,
        email: true,
        username: true,
        role_id: true
      }
    });
    return user;
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new Error('Email đã được sử dụng');
    }

    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ 
    where: {email},
    include: {
      role: {
        include: {
          permissions: true
        }
      }
    }
  });

  if (!user) throw new Error('Email không tồn tại');

  //kiem tra mat khau
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Mật khẩu sai');

  return buildLoginResult(user);
};

export const googleLoginUser = async (credential: string) => {
  if (!credential) {
    throw new Error('Thiếu token Google');
  }

  // const { OAuth2Client } = await import('google-auth-library');
  // const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  const ticket = await googleClient.verifyIdToken({
    idToken: credential, 
    audience: process.env.GOOGLE_CLIENT_ID,
  }as any);

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google token payload');
  }
  const googleId = payload.sub;
  const email = payload.email;
  if (!email) {
    throw new Error('Invalid Google token payload');
  }

  let user: any = await prisma.user.findUnique({
    where: { google_id: googleId },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!user) {
    if (email) {
      user = await prisma.user.findUnique ({
        where: {email},
        include :{
          role: {
            include: {
              permissions: true
            }
          }
        }
      });
    }
    
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id},
        data :{
          google_id: googleId
        },
        include:{
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
    else {
      const hashedPassword = await bcrypt.hash(`google-${Date.now()}`, 10);
      user = await prisma.user.create({
        data: {
          email,
          username: (payload.name ?? email.split('@')[0]) as string,
          password: hashedPassword,
          google_id: googleId,
          role_id: 2
        },
        include: {
          role:{
            include: {
              permissions: true
            }
          }
        }
      })
    }
  }

  return buildLoginResult(user);
};

export const facebookLoginUser = async (token: string) => {
  const fbRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`);
  const fbData: any = await fbRes.json();

  if(!fbData.email) throw new Error('Không lấy được email từ Facebook');
  
  const facebookId = fbData.id;

  let user = await prisma.user.findUnique({
    where: { facebook_id: facebookId },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: {email: fbData.email},
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    })

    if(user){
      user = await prisma.user.update ({
        where: {id: user.id},
        data: { facebook_id: facebookId},
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
    else {
      const hashedPassword = await bcrypt.hash(`facebook-${Date.now()}`, 10);
      user = await prisma.user.create ({
        data: {
          email: fbData.email,
          username: fbData.name,
          password: hashedPassword,
          facebook_id: facebookId,
          role_id: 2
        },
        include: {
          role: {
            include:{
              permissions: true
            }
          }
        }
      })
    }
  }

  return buildLoginResult(user);
};

export const hustLoginUser = async (taikhoan: string, matkhau: string) => {
  if(!taikhoan || !matkhau) {
    throw new Error ('Thiếu tài khoản hoặc mật khẩu Hust')
  }

  const apiUrl = process.env.HUST_AUTH_API_URL;

  const queryParams = new URLSearchParams({
    taikhoan: taikhoan.trim(),
    matkhau: matkhau.trim()
  }).toString();

  const fullUrl = `${apiUrl}?${queryParams}`;
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'accept': 'text/plain',
    },
  });

  const result = (await response.text()).trim();

  if(result !== "1") {
    throw new Error ('Tài khoản hoặc mật khẩu không chính xác')
  }

  let user = await prisma.user.findUnique({
    where: { hust_id: taikhoan },
    include: {
      role: {
        include: {
          permissions: true
        },
      },
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({ 
      where: { email: taikhoan},
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });

    if(user) {
      user = await prisma.user.update({
        where: { id: user.id},
        data: { hust_id: taikhoan},
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
    else {
      const emailPrefix = taikhoan.split('@')[0] ?? taikhoan;
      const username = emailPrefix.split('.')[0] ?? emailPrefix;
      const hashedPassword = await bcrypt.hash(`hust-${Date.now()}`, 10);
      user = await prisma.user.create ({
        data: {
          email: taikhoan,
          username: username,
          password: hashedPassword,
          hust_id: taikhoan,
          role_id: 2
        },
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
  }
  return buildLoginResult(user);
};
