import { Router } from 'express';
import { register, login, googleLogin, facebookLogin, hustLogin } from '../controllers/auth.controller.js';

const router = Router();
/**
 * @swagger
 * /tags:
 *  name: Auth
 *  description: API xach thuc nguoi dung
 */

/**
 * @swagger
 * /api/auth/register:
 *  post:
 *   summary: Dang ky tai khoan moi
 *   tags: [Auth]
 *   requestBody:
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        username:
 *         type: string
 *        email:
 *         type: string
 *        password:
 *         type: string
 *   responses:
 *    201:
 *     description: Nguoi dung duoc tao thanh cong
 *    400:
 *     description: Du lieu dau vao khong hop le
 */
router.post('/register', register);    // URL: http://localhost:3000/api/auth/register

/**
 * @swagger
 * /api/auth/login:
 *  post:
 *   summary: Dang nhap tai khoan
 *   tags: [Auth]
 *   requestBody:
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       properties:
 *        email:
 *         type: string
 *        password:
 *         type: string
 *   responses:
 *    200:
 *     description: Dang nhap thanh cong
 *    401:
 *     description: Sai mat khau hoac email khong ton tai
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/google-login:
 *  post:
 *   summary: Dang nhap bang Google
 *   tags: [Auth]
 *   requestBody:
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        token:
 *         type: string
 *   responses:
 *    200:
 *     description: Dang nhap thanh cong
 *    401:
 *     description: Token khong hop le hoac khong the xac thuc
 */
router.post('/google', googleLogin);

/**
 * @swagger
 * /api/auth/facebook:
 *  post:
 *   summary: Dang nhap bang Facebook
 *   tags: [Auth]
 *   requestBody:
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        token:
 *         type: string
 *   responses:
 *    200:
 *     description: Dang nhap thanh cong
 *    401:
 *     description: Token khong hop le hoac khong the xac thuc
 */
router.post('/facebook', facebookLogin);

/**
 * @swagger
 * /api/auth/hust:
 *  post:
 *   summary: Dang nhap bang tai khoan HUST
 *   tags: [Auth]
 *   requestBody:
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        taikhoan:
 *         type: string
 *        matkhau:
 *         type: string
 *   responses:
 *    200:
 *     description: Dang nhap thanh cong
 *    401:
 *     description: Tai khoan hoac mat khau khong chinh xac
 */
router.post('/hust', hustLogin);

export default router;