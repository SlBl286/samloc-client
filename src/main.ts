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

  // New panels for Room List separation
  private lobbyMainPanel: HTMLElement;
  private lobbyRoomsPanel: HTMLElement;
  private btnBrowseRooms: HTMLButtonElement;
  private btnBackToMenu: HTMLButtonElement;

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
  private selectRoomTurnLimit: HTMLSelectElement;
  private btnCancelCreateRoom: HTMLButtonElement;
  private btnSubmitCreateRoom: HTMLButtonElement;

  // Game Room elements
  private gameRoomName: HTMLElement;
  private gameRoomInfo: HTMLElement;
  private gameStatusLabel: HTMLElement;
  private gameTurnTip: HTMLElement;
  private gameSpectatorsCount: HTMLElement;
  
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
  private currentRoomTurnLimit: number = 15;
  private currentRoomBet: number = 1000;
  private currentUsername: string = '';
  private isSelfReady: boolean = false;
  private currentRoomPlayers: number[] = [];
  private currentRoomReadyPlayers: number[] = [];
  private currentRoomSpectators: number[] = [];
  private currentRoomGolds: Record<number, number> = {};
  private isGameEndRevealPhase: boolean = false;
  private isShowingConnectionError: boolean = false;

  constructor() {
    // 1. Initialize Screen Views
    this.lobbyView = document.getElementById('lobby-view')!;
    this.gameView = document.getElementById('game-view')!;

    // Initialize New Panels & Buttons
    this.lobbyMainPanel = document.getElementById('lobby-main-panel')!;
    this.lobbyRoomsPanel = document.getElementById('lobby-rooms-panel')!;
    this.btnBrowseRooms = document.getElementById('btn-browse-rooms') as HTMLButtonElement;
    this.btnBackToMenu = document.getElementById('btn-back-to-menu') as HTMLButtonElement;

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
    this.selectRoomTurnLimit = document.getElementById('create-room-turn-limit') as HTMLSelectElement;
    this.btnCancelCreateRoom = document.getElementById('btn-cancel-create-room') as HTMLButtonElement;
    this.btnSubmitCreateRoom = document.getElementById('btn-submit-create-room') as HTMLButtonElement;

    // 4. Initialize Game Room UI overlays
    this.gameRoomName = document.getElementById('game-room-name')!;
    this.gameRoomInfo = document.getElementById('game-room-info')!;
    this.gameStatusLabel = document.getElementById('game-status-label')!;
    this.gameTurnTip = document.getElementById('game-turn-tip')!;
    this.gameSpectatorsCount = document.getElementById('game-spectators-count')!;

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

    if (this.btnBrowseRooms) {
      this.btnBrowseRooms.addEventListener('click', () => {
        this.lobbyMainPanel.classList.add('hidden');
        this.lobbyRoomsPanel.classList.remove('hidden');
        // Refresh room list immediately on open
        if (this.isServerOnline) {
          this.wsClient.sendMessage({
            type: 'Connected',
            user_id: this.currentUserId
          });
        }
      });
    }

    if (this.btnBackToMenu) {
      this.btnBackToMenu.addEventListener('click', () => {
        this.lobbyRoomsPanel.classList.add('hidden');
        this.lobbyMainPanel.classList.remove('hidden');
      });
    }

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
        this.selectRoomTurnLimit.value = '15';
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
      const isHost = this.currentRoomPlayers[0] === this.currentUserId;
      if (isHost) {
        const otherReadyCount = this.currentRoomReadyPlayers.filter(p => p !== this.currentUserId).length;
        if (otherReadyCount === 0) {
          dialog.show('Bắt đầu ván đấu', 'Cần ít nhất 1 người chơi khác sẵn sàng để bắt đầu!', 'alert');
          return;
        }
        this.wsClient.startGame();
      } else {
        if (this.isSelfReady) {
          this.wsClient.unready();
        } else {
          this.wsClient.ready();
        }
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
        this.canvasEngine.clearTable(false);
        this.canvasEngine.setHand(msg.hand, true);
        
        this.btnReady.classList.add('hidden');
        this.btnAnnounceSam.classList.add('hidden');
        this.gameStatusLabel.classList.add('hidden');
        this.gameTurnTip.innerText = 'Bắt đầu ván đấu!';
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
        // Suppress placeholder success/processed notification alerts from the server
        if (msg.message && (
          msg.message.endsWith('processed') || 
          msg.message.includes('processed')
        )) {
          break;
        }
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
    this.currentRoomSpectators = [];
    this.currentRoomGolds = {};

    this.gameView.classList.add('hidden');
    this.lobbyView.classList.remove('hidden');
    
    // Reset back to main panel, hide rooms panel
    if (this.lobbyMainPanel) {
      this.lobbyMainPanel.classList.remove('hidden');
    }
    if (this.lobbyRoomsPanel) {
      this.lobbyRoomsPanel.classList.add('hidden');
    }
    
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

    this.canvasEngine.clearTable(false);
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
    this.currentRoomSpectators = room.spectators || [];
    const specCount = this.currentRoomSpectators.length;
    this.gameSpectatorsCount.innerText = specCount.toString();

    if (this.isGameEndRevealPhase) {
      this.currentRoomPlayers = room.players;
      this.isSelfReady = room.ready_players.includes(this.currentUserId);
      this.currentRoomTurnLimit = room.turn_limit || 15;
      this.currentRoomBet = room.bet_size;
      this.currentRoomReadyPlayers = room.ready_players;
      if (room.player_golds) {
        for (const k in room.player_golds) {
          this.currentRoomGolds[parseInt(k)] = room.player_golds[k];
        }
      }
      return;
    }

    this.gameRoomName.innerText = `${room.name} (#${room.id})`;
    this.gameRoomInfo.innerText = `Mức cược: ${room.bet_size.toLocaleString()} Gold | Số người: ${room.players.length}/${room.max_players}`;

    this.currentRoomPlayers = room.players;
    this.isSelfReady = room.ready_players.includes(this.currentUserId);
    this.currentRoomTurnLimit = room.turn_limit || 15;
    this.currentRoomBet = room.bet_size;
    this.currentRoomReadyPlayers = room.ready_players;

    const isHost = room.players[0] === this.currentUserId;

    if (isHost) {
      const otherReadyCount = room.ready_players.filter((p: number) => p !== this.currentUserId).length;
      this.btnReady.innerText = 'Bắt Đầu';
      if (otherReadyCount >= 1) {
        this.btnReady.className = 'px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
      } else {
        this.btnReady.className = 'px-6 py-2 bg-gray-700 opacity-50 text-gray-400 font-bold text-xs tracking-wider uppercase transition-all cursor-not-allowed';
      }
    } else {
      // Update ready button style
      if (this.isSelfReady) {
        this.btnReady.innerText = 'Hủy Sẵn Sàng';
        this.btnReady.className = 'px-6 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-900 text-rose-400 font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
      } else {
        this.btnReady.innerText = 'Sẵn Sàng';
        this.btnReady.className = 'px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
      }
    }

    // Render players in circles
    const counts: Record<number, number> = {};
    const passed: number[] = [];
    let activePlayer: number | null = null;
    const spectators: number[] = [...this.currentRoomSpectators];

    if (room.game_state) {
      activePlayer = room.game_state.active_player;
      room.players.forEach((p: number) => {
        if (room.game_state.hands && p in room.game_state.hands) {
          counts[p] = room.game_state.hands[p]?.length ?? 0;
        } else {
          spectators.push(p);
          counts[p] = 0;
        }
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

    if (spectators.includes(this.currentUserId)) {
      this.canvasEngine.setHand([], false);
      this.btnReady.classList.add('hidden');
      this.btnAnnounceSam.classList.add('hidden');
      this.btnPlayCards.classList.add('hidden');
      this.btnPass.classList.add('hidden');
    } else {
      if (!room.game_state) {
        this.btnReady.classList.remove('hidden');
      }
    }

    if (room.player_golds) {
      for (const k in room.player_golds) {
        this.currentRoomGolds[parseInt(k)] = room.player_golds[k];
      }
    }

    this.canvasEngine.renderRoomState(
      room.players,
      room.ready_players,
      activePlayer,
      counts,
      passed,
      this.currentUserId,
      this.currentRoomTurnLimit,
      spectators,
      this.currentRoomGolds
    );
  }

  // Process a turn hand update event
  private handleTurnUpdate(msg: any) {
    const isActive = msg.active_player_id === this.currentUserId;
    
    // Hide Sam announcement once card playing starts
    if (msg.last_played_cards.length > 0) {
      this.btnAnnounceSam.classList.add('hidden');
    }

    // Detect spectators (players in currentRoomPlayers who are not in player_card_counts)
    const spectators: number[] = [...this.currentRoomSpectators];
    this.currentRoomPlayers.forEach((p: number) => {
      if (msg.player_card_counts && !(p in msg.player_card_counts)) {
        if (!spectators.includes(p)) {
          spectators.push(p);
        }
      }
    });

    if (msg.player_golds) {
      const oldGolds = { ...this.currentRoomGolds };
      for (const k in msg.player_golds) {
        const pId = parseInt(k);
        const newGold = msg.player_golds[k];
        const oldGold = oldGolds[pId];
        if (oldGold !== undefined && oldGold !== newGold) {
          const diff = newGold - oldGold;
          if (diff > 0) {
            this.canvasEngine.showSpeechBubble(pId, `🔥 +${diff.toLocaleString()}`, 'win');
            this.canvasEngine.animateGoldChange(pId, diff);
          } else if (diff < 0) {
            this.canvasEngine.showSpeechBubble(pId, `💸 ${diff.toLocaleString()}`, 'lose');
            this.canvasEngine.animateGoldChange(pId, diff);
          }
        }
        this.currentRoomGolds[pId] = newGold;
      }
    }

    // Refresh circular player details & counts
    this.canvasEngine.renderRoomState(
      this.currentRoomPlayers,
      this.currentRoomPlayers, // Game started, show as ready
      msg.active_player_id,
      msg.player_card_counts,
      msg.passed_players,
      this.currentUserId,
      this.currentRoomTurnLimit,
      spectators,
      this.currentRoomGolds
    );

    // Render cards played in center
    this.canvasEngine.setLastPlayed(msg.last_played_cards, msg.last_played_by, true);

    // Remove successfully played cards from the player's hand so they vanish
    if (msg.last_played_by === this.currentUserId && msg.last_played_cards && msg.last_played_cards.length > 0) {
      this.canvasEngine.removeCardsFromHand(msg.last_played_cards);
    }

    if (spectators.includes(this.currentUserId)) {
      this.canvasEngine.setHand([], false);
      this.btnPlayCards.classList.add('hidden');
      this.btnPass.classList.add('hidden');
      this.btnAnnounceSam.classList.add('hidden');
      this.btnReady.classList.add('hidden');
      this.gameTurnTip.innerText = `Bạn đang xem chơi. Lượt của Player_${msg.active_player_id}...`;
    } else {
      if (msg.is_sam_phase) {
        // Sâm Announce Phase
        this.btnPlayCards.classList.add('hidden');
        if (isActive) {
          this.gameTurnTip.innerText = 'Đến lượt bạn quyết định báo Sâm!';
          this.btnAnnounceSam.classList.remove('hidden');
          // Under Sâm Phase, Pass means "Không Báo Sâm"
          this.btnPass.innerText = 'Không báo Sâm';
          this.btnPass.classList.remove('hidden');
        } else {
          this.gameTurnTip.innerText = `Đang chờ Player_${msg.active_player_id} báo Sâm...`;
          this.btnAnnounceSam.classList.add('hidden');
          this.btnPass.classList.add('hidden');
        }
      } else {
        // Normal card playing phase
        this.btnPass.innerText = 'Bỏ Lượt'; // Restore original button text
        this.btnAnnounceSam.classList.add('hidden');
        
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
    }
  }

  // Handle game end (victory announcements, card reveals)
  private async handleGameEnd(msg: any) {
    this.isGameEndRevealPhase = true;
    this.gameTurnTip.innerText = 'Trận đấu kết thúc!';
    this.btnPlayCards.classList.add('hidden');
    this.btnPass.classList.add('hidden');
    this.btnAnnounceSam.classList.add('hidden');

    // Display all hands in game canvas spots
    const counts: Record<number, number> = {};
    this.currentRoomPlayers.forEach((p: number) => {
      counts[p] = msg.hands[p]?.length ?? 0;
    });

    // Score / Money calculations
    const payouts: Record<number, number> = {};
    this.currentRoomPlayers.forEach(p => {
      payouts[p] = 0;
    });

    const activePlayerIds = Object.keys(msg.hands).map(k => parseInt(k));
    const otherActiveCount = activePlayerIds.length - 1;
    const bet = this.currentRoomBet;

    // Check Sâm announcer
    const samAnnouncerId = msg.sam_announcer ? parseInt(msg.sam_announcer) : null;

    if (samAnnouncerId !== null && activePlayerIds.includes(samAnnouncerId)) {
      // Sâm game
      if (msg.winner_id === samAnnouncerId) {
        // Sâm successful! Winner gets 20 * bet from all other active players
        let totalWin = 0;
        activePlayerIds.forEach(pId => {
          if (pId !== msg.winner_id) {
            const loss = 20 * bet;
            payouts[pId] = -loss;
            totalWin += loss;
          }
        });
        payouts[msg.winner_id] = totalWin;
      } else {
        // Sâm failed (đền sâm)! The announcer pays 20 * bet * otherActiveCount to the winner (blocker)
        const penalty = 20 * bet * otherActiveCount;
        payouts[samAnnouncerId] = -penalty;
        payouts[msg.winner_id] = penalty;
        // Other active players pay 0
        activePlayerIds.forEach(pId => {
          if (pId !== samAnnouncerId && pId !== msg.winner_id) {
            payouts[pId] = 0;
          }
        });
      }
    } else {
      // Normal game
      let totalWin = 0;
      activePlayerIds.forEach(pId => {
        if (pId !== msg.winner_id) {
          const hand = msg.hands[pId] || [];
          const cardsCount = hand.length;
          const heoCount = hand.filter((c: number) => Math.floor(c / 4) === 12).length;
          
          let loss = 0;
          if (cardsCount === 10) {
            // Cóng!
            loss = (15 + heoCount * 5) * bet;
          } else {
            loss = (cardsCount + heoCount * 5) * bet;
          }
          payouts[pId] = -loss;
          totalWin += loss;
        }
      });
      payouts[msg.winner_id] = totalWin;
    }

    // Apply payouts to currentRoomGolds locally so they display immediately
    for (const pId in payouts) {
      const id = parseInt(pId);
      this.currentRoomGolds[id] = (this.currentRoomGolds[id] || 100000) + payouts[id];
      if (this.currentRoomGolds[id] < 0) this.currentRoomGolds[id] = 0;
    }

    // Render the room state with the updated golds
    this.canvasEngine.renderRoomState(
      this.currentRoomPlayers,
      [],
      null,
      counts,
      [],
      this.currentUserId,
      this.currentRoomTurnLimit,
      this.currentRoomSpectators,
      this.currentRoomGolds
    );

    // Reveal all remaining cards on the canvas
    this.canvasEngine.revealPlayerCards(msg.hands, this.currentUserId);

    // Show speech bubbles for everyone's payouts
    this.currentRoomPlayers.forEach((pId: number) => {
      if (!activePlayerIds.includes(pId)) {
        this.canvasEngine.showSpeechBubble(pId, '👀 XEM CHƠI');
        return;
      }

      const payout = payouts[pId] ?? 0;
      const payoutStr = payout >= 0 ? `+${payout.toLocaleString()}` : `${payout.toLocaleString()}`;

      let detail = '';
      if (pId !== msg.winner_id) {
        const hand = msg.hands[pId] || [];
        const cardsCount = hand.length;
        if (samAnnouncerId !== null) {
          if (pId === samAnnouncerId) {
            detail = ' (Đền Sâm)';
          }
        } else {
          if (cardsCount === 10) {
            detail = ' (Cóng)';
          }
        }
      } else {
        if (samAnnouncerId === msg.winner_id) {
          detail = ' (Báo Sâm)';
        } else if (samAnnouncerId !== null) {
          detail = ' (Chặn Sâm)';
        } else {
          detail = ' (Thắng)';
        }
      }

      const bubbleText = `${payoutStr} Gold${detail}`;
      this.canvasEngine.showSpeechBubble(pId, payout >= 0 ? `🎉 ${bubbleText}` : `💸 ${bubbleText}`, payout >= 0 ? 'win' : 'lose');
      this.canvasEngine.animateGoldChange(pId, payout);
    });

    this.gameTurnTip.innerText = 'Trận đấu kết thúc! Chuẩn bị ván mới sau 5 giây...';

    setTimeout(() => {
      // Exit reveal phase
      this.isGameEndRevealPhase = false;

      // Reset table canvas for new round
      this.canvasEngine.clearTable(false);

      // Restore ready state and info message
      this.canvasEngine.renderRoomState(
        this.currentRoomPlayers,
        this.currentRoomReadyPlayers,
        null,
        {},
        [],
        this.currentUserId,
        this.currentRoomTurnLimit,
        this.currentRoomSpectators,
        this.currentRoomGolds
      );

      // Show ready button again for next game
      const isHost = this.currentRoomPlayers[0] === this.currentUserId;
      if (isHost) {
        const otherReadyCount = this.currentRoomReadyPlayers.filter(p => p !== this.currentUserId).length;
        this.btnReady.innerText = 'Bắt Đầu';
        if (otherReadyCount >= 1) {
          this.btnReady.className = 'px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
        } else {
          this.btnReady.className = 'px-6 py-2 bg-gray-700 opacity-50 text-gray-400 font-bold text-xs tracking-wider uppercase transition-all cursor-not-allowed';
        }
      } else {
        this.btnReady.innerText = 'Sẵn Sàng';
        this.btnReady.className = 'px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer';
      }
      this.btnReady.classList.remove('hidden');
      this.isSelfReady = false;
      this.gameTurnTip.innerText = 'Đang chờ người chơi sẵn sàng...';
    }, 5000);
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
    const turnLimit = parseInt(this.selectRoomTurnLimit.value);

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
        this.wsClient.createRoom(roomName, maxPlayers, betSize, password || undefined, turnLimit);
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
