import './index.css';
import { AuthManager } from './components/Auth';
import type { UserSession } from './components/Auth';
import { dialog } from './components/Dialog';
import { GameCanvas } from './engine/GameCanvas';
import { WebSocketClient } from './engine/WebSocketClient';
import { gsap } from 'gsap';

class AppController {
  private canvasEngine: GameCanvas;
  private wsClient: WebSocketClient;
  private auth: AuthManager;

  // Screen View containers
  private lobbyView: HTMLElement;
  private gameView: HTMLElement;

  // Lobby elements
  private lobbyRoomsList: HTMLElement;
  private btnRefreshRooms: HTMLButtonElement;
  private activeRoomsCount: HTMLElement;

  // Create Room modal elements
  private createRoomModal: HTMLElement;
  private createRoomCard: HTMLElement;
  private createRoomForm: HTMLElement;
  private createRoomError: HTMLElement;
  private inputRoomName: HTMLInputElement;
  private inputRoomBet: HTMLInputElement;
  private selectRoomMaxPlayers: HTMLSelectElement;
  private inputRoomPassword: HTMLInputElement;
  private btnCancelCreateRoom: HTMLButtonElement;
  private btnSubmitCreateRoom: HTMLButtonElement;

  // Game Room elements
  private gameRoomName: HTMLElement;
  private gameRoomInfo: HTMLElement;
  private gameStatusLabel: HTMLElement;
  private gameTurnTip: HTMLElement;
  
  // Game Actions
  private btnLeaveRoom: HTMLButtonElement;
  private btnReady: HTMLButtonElement;
  private btnAnnounceSam: HTMLButtonElement;
  private btnPlayCards: HTMLButtonElement;
  private btnPass: HTMLButtonElement;

  // State Management
  private isServerOnline: boolean = false;
  private currentRoomId: number | null = null;
  private currentUserId: number = 0;
  private currentUsername: string = '';
  private isSelfReady: boolean = false;
  private currentRoomPlayers: number[] = [];
  private isShowingConnectionError: boolean = false;

  constructor() {
    // 1. Initialize Screen Views
    this.lobbyView = document.getElementById('lobby-view')!;
    this.gameView = document.getElementById('game-view')!;

    // 2. Initialize Lobby components
    this.lobbyRoomsList = document.getElementById('lobby-rooms-list')!;
    this.btnRefreshRooms = document.getElementById('btn-refresh-rooms') as HTMLButtonElement;
    this.activeRoomsCount = document.getElementById('active-rooms-count')!;

    // 3. Initialize Create Room Modal
    this.createRoomModal = document.getElementById('create-room-modal')!;
    this.createRoomCard = document.getElementById('create-room-card')!;
    this.createRoomForm = document.getElementById('create-room-form')!;
    this.createRoomError = document.getElementById('create-room-error')!;
    
    this.inputRoomName = document.getElementById('create-room-name') as HTMLInputElement;
    this.inputRoomBet = document.getElementById('create-room-bet') as HTMLInputElement;
    this.selectRoomMaxPlayers = document.getElementById('create-room-max-players') as HTMLSelectElement;
    this.inputRoomPassword = document.getElementById('create-room-password') as HTMLInputElement;
    this.btnCancelCreateRoom = document.getElementById('btn-cancel-create-room') as HTMLButtonElement;
    this.btnSubmitCreateRoom = document.getElementById('btn-submit-create-room') as HTMLButtonElement;

    // 4. Initialize Game Room UI overlays
    this.gameRoomName = document.getElementById('game-room-name')!;
    this.gameRoomInfo = document.getElementById('game-room-info')!;
    this.gameStatusLabel = document.getElementById('game-status-label')!;
    this.gameTurnTip = document.getElementById('game-turn-tip')!;

    // 5. Initialize Game Action buttons
    this.btnLeaveRoom = document.getElementById('btn-leave-room') as HTMLButtonElement;
    this.btnReady = document.getElementById('btn-ready') as HTMLButtonElement;
    this.btnAnnounceSam = document.getElementById('btn-announce-sam') as HTMLButtonElement;
    this.btnPlayCards = document.getElementById('btn-play-cards') as HTMLButtonElement;
    this.btnPass = document.getElementById('btn-pass') as HTMLButtonElement;

    // 6. Initialize Canvas Engine & Subsystems
    this.canvasEngine = new GameCanvas();
    
    // WS Client linking directly to message router
    this.wsClient = new WebSocketClient(
      (status) => this.handleServerStatusChange(status),
      (msg) => this.handleServerMessage(msg)
    );

    // Auth Manager coordinating sessions
    this.auth = new AuthManager(
      (session) => this.handleLoginSuccess(session),
      () => this.handleLogout()
    );

    this.setupListeners();
  }

  private setupListeners() {
    const btnQuickPlay = document.getElementById('btn-quick-play');
    const btnCreateRoom = document.getElementById('btn-create-room');
    const btnJoinCode = document.getElementById('btn-join-code');

    if (btnJoinCode) {
      btnJoinCode.addEventListener('click', async () => {
        if (!this.isServerOnline) {
          await dialog.show('Chơi Offline', 'Tính năng vào phòng theo mã cần kết nối máy chủ!', 'alert');
          return;
        }

        const codeStr = await dialog.show('Vào Bàn Theo Mã', 'Nhập mã số phòng chơi (ví dụ: 1):', 'prompt');
        if (codeStr !== null && codeStr.trim() !== '') {
          const roomId = parseInt(codeStr.trim());
          if (isNaN(roomId)) {
            dialog.show('Lỗi', 'Mã số phòng không hợp lệ!', 'alert');
            return;
          }
          this.wsClient.joinRoom(roomId);
        }
      });
    }

    if (btnQuickPlay) {
      btnQuickPlay.addEventListener('click', async () => {
        if (!this.isServerOnline) {
          await dialog.show('Chơi Offline', 'Chế độ chơi nhanh Demo trên Sandbox!', 'alert');
          this.canvasEngine.shuffleAndDeal();
          return;
        }

        // Quick join logic: search for any available room that is waiterng and has space
        this.wsClient.sendMessage({ type: 'Connected', user_id: this.currentUserId }); // Request refreshed rooms
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        // Quick join first available
        const joinBtn = this.lobbyRoomsList.querySelector('.btn-join-room') as HTMLButtonElement;
        if (joinBtn) {
          joinBtn.click();
        } else {
          // No rooms: auto create one
          const name = `Bàn nhanh của ${this.currentUsername || 'Player'}`;
          this.wsClient.createRoom(name, 4, 1000);
        }
      });
    }

    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        const username = this.auth.getCurrentUser()?.username || 'Chủ phòng';
        this.inputRoomName.value = `Bàn của ${username}`;
        this.inputRoomBet.value = '1000';
        this.selectRoomMaxPlayers.value = '4';
        this.inputRoomPassword.value = '';
        this.showCreateRoomModal();
      });
    }

    // Modal cancellation
    this.btnCancelCreateRoom.addEventListener('click', () => this.hideCreateRoomModal());
    this.createRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateRoomSubmit();
    });

    // Refresh Room List manual button
    if (this.btnRefreshRooms) {
      this.btnRefreshRooms.addEventListener('click', () => {
        if (this.isServerOnline) {
          this.wsClient.sendMessage({
            type: 'Connected',
            user_id: this.currentUserId
          });
        }
      });
    }

    // In-game leave room button
    if (this.btnLeaveRoom) {
      this.btnLeaveRoom.addEventListener('click', async () => {
        const leave = await dialog.show('Rời bàn', 'Bạn muốn rời khỏi bàn chơi này?', 'confirm');
        if (leave && this.currentRoomId !== null) {
          this.wsClient.leaveRoom(this.currentRoomId);
        }
      });
    }

    // Ready Action Toggle
    this.btnReady.addEventListener('click', () => {
      if (this.isSelfReady) {
        this.wsClient.unready();
      } else {
        this.wsClient.ready();
      }
    });

    // Pass Action
    this.btnPass.addEventListener('click', () => {
      this.wsClient.passTurn();
    });

    // Announce Sâm Action
    this.btnAnnounceSam.addEventListener('click', () => {
      this.wsClient.announceSam();
      this.btnAnnounceSam.classList.add('hidden');
    });

    // Play Cards Action
    this.btnPlayCards.addEventListener('click', () => {
      const selected = this.canvasEngine.getSelectedCards();
      if (selected.length === 0) {
        dialog.show('Đánh bài', 'Vui lòng click chọn ít nhất 1 quân bài!', 'alert');
        return;
      }
      this.wsClient.playCards(selected);
    });

    // Fullscreen Toggle
    const btnFullscreenLobby = document.getElementById('btn-fullscreen-lobby');
    const btnFullscreenGame = document.getElementById('btn-fullscreen-game');

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen toggle error:", err);
        });
      } else {
        document.exitFullscreen();
      }
    };

    if (btnFullscreenLobby) {
      btnFullscreenLobby.addEventListener('click', toggleFullscreen);
    }
    if (btnFullscreenGame) {
      btnFullscreenGame.addEventListener('click', toggleFullscreen);
    }
  }

  // Server Status State Machine
  private async handleServerStatusChange(status: 'connecting' | 'connected' | 'disconnected') {
    if (status === 'connecting') {
      this.isServerOnline = false;
    } else if (status === 'connected') {
      this.isServerOnline = true;
      this.isShowingConnectionError = false;
    } else {
      this.isServerOnline = false;
      this.showLobbyView();

      // Show popup with only Retry or Exit if not already showing
      if (!this.isShowingConnectionError) {
        this.isShowingConnectionError = true;

        const btnCancel = document.getElementById('custom-dialog-btn-cancel')!;
        const btnOk = document.getElementById('custom-dialog-btn-ok')!;
        
        btnCancel.innerText = 'Thoát';
        btnOk.innerText = 'Thử lại';

        const retry = await dialog.show(
          'Lỗi kết nối',
          'Không thể kết nối đến máy chủ game. Vui lòng kiểm tra lại đường truyền!',
          'confirm'
        );

        btnCancel.innerText = 'Hủy';
        btnOk.innerText = 'Đồng ý';
        this.isShowingConnectionError = false;

        if (retry) {
          this.wsClient.connect(this.currentUserId);
        } else {
          window.location.href = 'about:blank';
        }
      }
    }
  }

  // Router for WebSocket Messages from Rust Server
  private handleServerMessage(msg: any) {
    console.log('Main App received WS Message:', msg);

    switch (msg.type) {
      case 'RoomList':
        this.renderRoomsList(msg.rooms);
        break;

      case 'PlayerJoinedRoom':
        // Transition to game board view if it's us
        if (msg.user_id === this.currentUserId) {
          this.showGameView(msg.room_id);
        }
        break;

      case 'PlayerLeftRoom':
        // If we left the room, transition back to lobby view
        if (msg.user_id === this.currentUserId) {
          this.showLobbyView();
        }
        break;

      case 'RoomInfo':
        this.updateRoomDetails(msg.room);
        break;

      case 'GameStarted':
        // Set player hand cards with fan dealing animation
        this.canvasEngine.clearTable();
        this.canvasEngine.setHand(msg.hand, true);
        
        this.btnReady.classList.add('hidden');
        this.btnAnnounceSam.classList.remove('hidden');
        this.gameStatusLabel.classList.add('hidden');
        this.gameTurnTip.innerText = 'Bắt đầu ván đấu! Bạn có muốn báo Sâm?';
        break;

      case 'TurnUpdated':
        this.handleTurnUpdate(msg);
        break;

      case 'SamAnnounced':
        this.gameStatusLabel.innerText = 'CÓ NGƯỜI BÁO SÂM!';
        this.gameStatusLabel.classList.remove('hidden');
        this.canvasEngine.showSpeechBubble(msg.player_id, '⚡ BÁO SÂM!');
        break;

      case 'GameEnded':
        this.handleGameEnd(msg);
        break;

      case 'PlayerReadyUpdated':
        // Handled collectively in RoomInfo broadcasts. But we can show a quick bubble
        this.canvasEngine.showSpeechBubble(msg.user_id, msg.ready ? 'SẴN SÀNG!' : 'CHƯA SẴN SÀNG');
        break;

      case 'Error':
        dialog.show('Thông báo từ Server', msg.message, 'alert');
        break;

      default:
        console.warn('Unhandled message type:', msg.type);
    }
  }

  // Switch to Lobby UI state
  private showLobbyView() {
    this.currentRoomId = null;
    this.isSelfReady = false;
    this.currentRoomPlayers = [];

    this.gameView.classList.add('hidden');
    this.lobbyView.classList.remove('hidden');
    
    this.canvasEngine.clearTable();
  }

  // Switch to Game Room UI state
  private showGameView(roomId: number) {
    this.currentRoomId = roomId;
    this.isSelfReady = false;

    this.lobbyView.classList.add('hidden');
    this.gameView.classList.remove('hidden');
    
    this.gameRoomName.innerText = `Bàn Chơi #${roomId}`;
    this.gameRoomInfo.innerText = 'Đang tải thông tin bàn...';
    
    this.btnReady.innerText = 'Sẵn Sàng';
    this.btnReady.className = 'px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
    this.btnReady.classList.remove('hidden');

    this.btnAnnounceSam.classList.add('hidden');
    this.btnPlayCards.classList.add('hidden');
    this.btnPass.classList.add('hidden');

    this.gameStatusLabel.classList.add('hidden');
    this.gameTurnTip.innerText = 'Đang chờ người chơi sẵn sàng...';

    this.canvasEngine.clearTable();
  }

  // Render rooms inside the Lobby grid
  private renderRoomsList(rooms: any[]) {
    this.lobbyRoomsList.innerHTML = '';
    let playingRooms = 0;

    if (!rooms || rooms.length === 0) {
      this.lobbyRoomsList.innerHTML = `<p class="text-xs text-gray-500 italic py-2 col-span-2 text-center">Không tìm thấy phòng chơi nào. Hãy tạo bàn chơi mới!</p>`;
      this.activeRoomsCount.innerText = '0 Bàn Đang Chơi';
      return;
    }

    rooms.forEach((room: any) => {
      if (room.status === 'Playing') {
        playingRooms++;
      }

      const pCount = room.players.length;
      const mPlayers = room.max_players;
      
      const card = document.createElement('div');
      card.className = 'glass-card p-3 rounded-lg flex items-center justify-between border border-white/5 hover:border-pink-500/35 transition-all duration-200 pointer-events-auto';
      
      card.innerHTML = `
        <div>
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-white text-xs">${room.name}</h4>
            ${room.password ? '<span class="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">🔒 Password</span>' : ''}
          </div>
          <p class="text-[10px] text-gray-500 mt-1">
            Cược: <strong class="text-pink-500">${room.bet_size.toLocaleString()}</strong> | 
            Trạng thái: <strong class="${room.status === 'Playing' ? 'text-amber-500' : 'text-emerald-500'}">${room.status === 'Playing' ? 'ĐANG CHƠI' : 'ĐANG CHỜ'}</strong>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-bold text-gray-400">${pCount}/${mPlayers}</span>
          <button class="btn-join-room px-3 py-1.5 rounded bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-bold uppercase transition-colors cursor-pointer" data-id="${room.id}">
            Vào
          </button>
        </div>
      `;

      // Event listener for join room
      const joinBtn = card.querySelector('.btn-join-room') as HTMLButtonElement;
      joinBtn.addEventListener('click', async () => {
        if (room.password) {
          const pass = await dialog.show('Mật khẩu', 'Nhập mật khẩu để vào bàn chơi này:', 'prompt');
          if (pass !== room.password) {
            dialog.show('Sai mật khẩu', 'Mật khẩu bàn chơi không chính xác!', 'alert');
            return;
          }
        }
        this.wsClient.joinRoom(room.id);
      });

      this.lobbyRoomsList.appendChild(card);
    });

    this.activeRoomsCount.innerText = `${playingRooms} Bàn Đang Chơi`;
  }

  // Update game room details based on RoomInfo state
  private updateRoomDetails(room: any) {
    this.gameRoomName.innerText = `${room.name} (#${room.id})`;
    this.gameRoomInfo.innerText = `Mức cược: ${room.bet_size.toLocaleString()} Gold | Số người: ${room.players.length}/${room.max_players}`;

    this.currentRoomPlayers = room.players;
    this.isSelfReady = room.ready_players.includes(this.currentUserId);

    // Update ready button style
    if (this.isSelfReady) {
      this.btnReady.innerText = 'Hủy Sẵn Sàng';
      this.btnReady.className = 'px-6 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-900 text-rose-400 font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
    } else {
      this.btnReady.innerText = 'Sẵn Sàng';
      this.btnReady.className = 'px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
    }

    // Render players in circles
    const counts: Record<number, number> = {};
    const passed: number[] = [];
    let activePlayer: number | null = null;

    if (room.game_state) {
      activePlayer = room.game_state.active_player;
      room.players.forEach((p: number) => {
        counts[p] = room.game_state.hands[p]?.length ?? 0;
      });
      room.game_state.passed_players.forEach((p: number) => passed.push(p));
      
      // Update central discard pile
      this.canvasEngine.setLastPlayed(
        room.game_state.last_played_cards,
        room.game_state.last_played_by,
        false
      );

      this.btnReady.classList.add('hidden');
    }

    this.canvasEngine.renderRoomState(
      room.players,
      room.ready_players,
      activePlayer,
      counts,
      passed,
      this.currentUserId
    );
  }

  // Process a turn hand update event
  private handleTurnUpdate(msg: any) {
    const isActive = msg.active_player_id === this.currentUserId;
    
    // Hide Sam announcement once card playing starts
    if (msg.last_played_cards.length > 0) {
      this.btnAnnounceSam.classList.add('hidden');
    }

    // Refresh circular player details & counts
    this.canvasEngine.renderRoomState(
      this.currentRoomPlayers,
      this.currentRoomPlayers, // Game started, show as ready
      msg.active_player_id,
      msg.player_card_counts,
      msg.passed_players,
      this.currentUserId
    );

    // Render cards played in center
    this.canvasEngine.setLastPlayed(msg.last_played_cards, msg.last_played_by, true);

    // Show/hide action buttons for current turn
    if (isActive) {
      this.gameTurnTip.innerText = 'Đến lượt của bạn!';
      this.btnPlayCards.classList.remove('hidden');
      
      // Can only pass if there is already a card block played on the table
      if (msg.last_played_cards.length > 0) {
        this.btnPass.classList.remove('hidden');
      } else {
        this.btnPass.classList.add('hidden');
      }
    } else {
      this.gameTurnTip.innerText = `Lượt của Player_${msg.active_player_id}...`;
      this.btnPlayCards.classList.add('hidden');
      this.btnPass.classList.add('hidden');
    }
  }

  // Handle game end (victory announcements, card reveals)
  private async handleGameEnd(msg: any) {
    this.gameTurnTip.innerText = 'Trận đấu kết thúc!';
    this.btnPlayCards.classList.add('hidden');
    this.btnPass.classList.add('hidden');
    this.btnAnnounceSam.classList.add('hidden');

    // Display all hands in game canvas spots
    const counts: Record<number, number> = {};
    this.currentRoomPlayers.forEach((p: number) => {
      counts[p] = msg.hands[p]?.length ?? 0;
    });

    this.canvasEngine.renderRoomState(
      this.currentRoomPlayers,
      [],
      null,
      counts,
      [],
      this.currentUserId
    );

    // Create a detailed overlay message
    const winnerName = msg.winner_id === this.currentUserId ? 'BẠN' : `Player_${msg.winner_id}`;
    let endMessage = `🎉 Người thắng cuộc: <strong>${winnerName}</strong><br/>` + 
                     `💬 Nguyên nhân: <span class="text-pink-500 font-semibold">${msg.reason}</span><br/><br/>`;
    
    endMessage += `<strong class="text-xs uppercase text-gray-400 tracking-wider">Bài của các kỳ thủ:</strong><br/>`;
    
    Object.keys(msg.hands).forEach((pStr: string) => {
      const pId = parseInt(pStr);
      const isSelf = pId === this.currentUserId;
      const name = isSelf ? 'Bạn' : `Player_${pId}`;
      const cardsInHand = msg.hands[pId] as number[];
      
      // Simple text description of card count
      endMessage += `• ${name}: <strong>${cardsInHand.length} lá còn lại</strong><br/>`;
    });

    await dialog.show('Ván Đấu Kết Thúc', endMessage, 'alert');

    // Show ready button again for next game
    this.btnReady.innerText = 'Sẵn Sàng';
    this.btnReady.className = 'px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
    this.btnReady.classList.remove('hidden');
    this.isSelfReady = false;
  }

  // Setup account details upon login
  private handleLoginSuccess(session: UserSession) {
    this.currentUserId = session.user_id;
    this.currentUsername = session.username;
    this.wsClient.connect(session.user_id);
  }

  // Reset lobby on logout
  private handleLogout() {
    this.showLobbyView();
    const guestId = Math.floor(Math.random() * 100000);
    this.currentUserId = guestId;
    this.currentUsername = `Guest_${guestId}`;
    this.wsClient.connect(guestId);
  }

  // Create Room modal triggers
  private showCreateRoomModal() {
    this.createRoomError.classList.add('hidden');
    this.createRoomModal.classList.add('modal-show');
    gsap.fromTo(this.createRoomCard,
      { scale: 0.95, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' }
    );
  }

  private hideCreateRoomModal() {
    this.createRoomModal.classList.remove('modal-show');
  }

  private async handleCreateRoomSubmit() {
    const roomName = this.inputRoomName.value.trim();
    const betSize = parseInt(this.inputRoomBet.value);
    const maxPlayers = parseInt(this.selectRoomMaxPlayers.value);
    const password = this.inputRoomPassword.value.trim();

    if (!roomName) {
      this.showCreateRoomError('Vui lòng nhập tên phòng!');
      return;
    }

    if (isNaN(betSize) || betSize < 100) {
      this.showCreateRoomError('Mức cược tối thiểu là 100 Gold!');
      return;
    }

    try {
      this.btnSubmitCreateRoom.classList.add('pointer-events-none', 'opacity-75');
      
      if (this.isServerOnline) {
        this.wsClient.createRoom(roomName, maxPlayers, betSize, password || undefined);
      } else {
        // Fallback demo sandbox
        this.showGameView(Math.floor(Math.random() * 1000));
        this.gameRoomName.innerText = `${roomName} (Sandbox)`;
        this.gameRoomInfo.innerText = `Mức cược: ${betSize.toLocaleString()} Gold`;
        this.canvasEngine.shuffleAndDeal();
      }

      this.hideCreateRoomModal();
    } catch (err: any) {
      this.showCreateRoomError(err.message || 'Có lỗi xảy ra!');
    } finally {
      this.btnSubmitCreateRoom.classList.remove('pointer-events-none', 'opacity-75');
    }
  }

  private showCreateRoomError(msg: string) {
    this.createRoomError.innerText = msg;
    this.createRoomError.classList.remove('hidden');
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
