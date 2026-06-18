export class WebSocketClient {
  private socket: WebSocket | null = null;
  private onStateChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
  private onMessageReceived?: (msg: any) => void;
  
  private userId: number = 0;

  constructor(
    onStateChange: (status: 'connecting' | 'connected' | 'disconnected') => void,
    onMessageReceived?: (msg: any) => void
  ) {
    this.onStateChange = onStateChange;
    this.onMessageReceived = onMessageReceived;
  }

  public connect(userId: number) {
    this.userId = userId;

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }

    this.onStateChange('connecting');
    const hostname = window.location.hostname || '127.0.0.1';

    try {
      this.socket = new WebSocket(`ws://${hostname}:8080`);

      this.socket.onopen = () => {
        this.onStateChange('connected');
        console.log('Connected to Rust Sam Loc Server!');
        
        // Register player session over WS using internally tagged Serde JSON format
        this.sendMessage({
          type: 'Connected',
          user_id: this.userId
        });
      };

      this.socket.onmessage = (event) => {
        if (this.onMessageReceived) {
          try {
            const data = JSON.parse(event.data);
            this.onMessageReceived(data);
          } catch (e) {
            console.error('Failed to parse WS message:', event.data);
          }
        }
      };

      this.socket.onerror = () => {
        this.onStateChange('disconnected');
      };

      this.socket.onclose = () => {
        this.onStateChange('disconnected');
      };
    } catch (e) {
      this.onStateChange('disconnected');
    }
  }

  public sendMessage(msg: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      console.warn('Cannot send message, WebSocket not open:', msg);
    }
  }

  public createRoom(roomName: string, maxPlayers: number, betSize: number, password?: string) {
    this.sendMessage({
      type: 'CreateRoom',
      room_name: roomName,
      max_players: maxPlayers,
      bet_size: betSize,
      password: password || null
    });
  }

  public joinRoom(roomId: number) {
    this.sendMessage({
      type: 'JoinRoom',
      room_id: roomId
    });
  }

  public leaveRoom(roomId: number) {
    this.sendMessage({
      type: 'LeaveRoom',
      room_id: roomId
    });
  }

  public ready() {
    this.sendMessage({
      type: 'Ready'
    });
  }

  public unready() {
    this.sendMessage({
      type: 'Unready'
    });
  }

  public playCards(cards: number[]) {
    this.sendMessage({
      type: 'PlayCards',
      cards
    });
  }

  public passTurn() {
    this.sendMessage({
      type: 'PassTurn'
    });
  }

  public announceSam() {
    this.sendMessage({
      type: 'AnnounceSam'
    });
  }
}
