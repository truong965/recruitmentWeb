import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface JwtPayload {
  _id: string; // User ID
  email: string;
  name: string;
  role: any; //
  company: any;
  sub: string; // "token login"
  iss: string; //from server
  iat?: number; // Tự động có
  exp?: number;
}
@WebSocketGateway({
  cors: {
    /**
     * [CORS FIX] Bảo mật kết nối WebSocket
     * LOGIC:
     * - Thay vì để origin: '*', ta sử dụng callback để kiểm tra nguồn gốc request.
     * - Chỉ cho phép các domain trong Whitelist (Localhost, Frontend URL, Admin URL).
     *
     * MỤC ĐÍCH:
     * - Ngăn chặn tấn công CSWSH (Cross-Site WebSocket Hijacking).
     * - Đảm bảo chỉ client hợp lệ của hệ thống mới kết nối được.
     */
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  namespace: '/files',
})
export class FilesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FilesGateway.name);
  private userSocketMap = new Map<string, Set<string>>();
  private readonly allowedOrigins: string[];

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      this.configService.get<string>('FRONTEND_URL'),
      this.configService.get<string>('ADMIN_URL'),
    ].filter((origin): origin is string => Boolean(origin));

    this.logger.log(`Allowed CORS origins: ${this.allowedOrigins.join(', ')}`);
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    // [SECURITY] Kiểm tra Origin lần 2 (Defense in Depth)
    const origin = client.handshake.headers.origin;

    if (origin && !this.allowedOrigins.includes(origin)) {
      this.logger.warn(
        `Rejected connection from unauthorized origin: ${origin}`,
      );
      client.disconnect();
      return;
    }

    try {
      // [SECURITY] Xác thực Token ngay tại bước Handshake
      // LOGIC: Lấy token từ Header/Auth Object -> Verify JWT -> Lấy User Info.
      // MỤC ĐÍCH: Không cho phép kết nối nặc danh (Anonymous). Tiết kiệm tài nguyên server.
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = await this.validateToken(token);

      if (!payload) {
        this.logger.warn(`Client ${client.id} has invalid token`);
        client.disconnect();
        return;
      }

      client.userId = payload._id;
      client.userEmail = payload.email;

      // [LOGIC] Mapping User <-> Socket ID
      // Lưu danh sách socket ID vào Map theo User ID để khi Worker báo xong, ta biết gửi cho socket nào.
      // (Lưu ý: Logic này lưu trên RAM, cần Redis Adapter nếu scale nhiều server)
      if (!this.userSocketMap.has(client.userId)) {
        this.userSocketMap.set(client.userId, new Set());
      }
      this.userSocketMap.get(client.userId)!.add(client.id);

      this.logger.log(
        `Client connected: ${client.id} (User: ${client.userEmail})`,
      );
      this.logger.log(
        `Active connections for user ${client.userId}: ${this.userSocketMap.get(client.userId)!.size}`,
      );

      client.emit('connected', {
        message: 'Connected to file upload notifications',
        userId: client.userId,
      });
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.userSocketMap.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSocketMap.delete(client.userId);
        }
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: AuthenticatedSocket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  notifyUploadComplete(userId: string, data: any) {
    const userSockets = this.userSocketMap.get(userId);

    if (!userSockets || userSockets.size === 0) {
      this.logger.debug(`No active connections for user ${userId}`);
      return;
    }

    this.logger.log(
      `Notifying user ${userId} on ${userSockets.size} connection(s)`,
    );

    userSockets.forEach((socketId) => {
      this.server.to(socketId).emit('upload:completed', data);
    });
  }

  notifyUploadFailed(userId: string, data: any) {
    const userSockets = this.userSocketMap.get(userId);

    if (!userSockets || userSockets.size === 0) {
      return;
    }

    userSockets.forEach((socketId) => {
      this.server.to(socketId).emit('upload:failed', data);
    });
  }

  notifyUploadProgress(userId: string, data: any) {
    const userSockets = this.userSocketMap.get(userId);

    if (!userSockets || userSockets.size === 0) {
      return;
    }

    userSockets.forEach((socketId) => {
      this.server.to(socketId).emit('upload:progress', data);
    });
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    // Ép kiểu client.handshake.auth về dạng object có key token là string
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      return auth.token;
    }

    // const queryToken = client.handshake.query?.token;
    // if (queryToken) {
    //   // Đảm bảo chỉ lấy string (nếu là mảng thì lấy phần tử đầu)
    //   return Array.isArray(queryToken) ? queryToken[0] : queryToken;
    // }

    return null;
  }

  private async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const secret = this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
      return payload;
    } catch (error) {
      this.logger.error('Token validation failed', error);
      return null;
    }
  }

  getActiveConnections(): number {
    let total = 0;
    this.userSocketMap.forEach((sockets) => {
      total += sockets.size;
    });
    return total;
  }

  getActiveUsers(): number {
    return this.userSocketMap.size;
  }
}
