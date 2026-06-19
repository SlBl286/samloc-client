import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

export class GameCanvas {
  private app!: Application;
  private cardContainer!: Container;
  private deckContainer!: Container;
  private playerContainer!: Container;
  private pileContainer!: Container;
  private tableGraphic!: Graphics;

  private cards: Array<{
    container: Container;
    bg: Graphics;
    glowBorder: Graphics;
    rankText: Text;
    suitText: Text;
    rank: string;
    suit: string;
    color: string;
    value: number; // Actual card value (0..51)
    isSelected: boolean;
    isDealt: boolean;
  }> = [];

  private playerSpots: Map<number, Container> = new Map();

  // Cached room state to re-render spots on window resize
  private lastRoomPlayers: number[] = [];
  private lastReadyPlayers: number[] = [];
  private lastActivePlayerId: number | null = null;
  private lastCardCounts: Record<number, number> = {};
  private lastPassedPlayers: number[] = [];
  private lastSelfId: number = 0;
  private lastSpectators: number[] = [];
  private lastTurnLimitSeconds: number = 15;

  // Cached center pile state to re-render on resize
  private lastPlayedCards: number[] = [];
  private lastPlayedById: number | null = null;

  // Turn timer visuals
  private turnTimerGraphic!: Graphics;
  private turnTimerActivePlayerId: number | null = null;
  private turnTimerRemaining: number = 0;
  private turnTimerDuration: number = 0;

  private suits = [
    { char: '♠', name: 'spades', color: '#2563eb' }, // Clean blue spades
    { char: '♣', name: 'clubs', color: '#16a34a' },  // Clean green clubs
    { char: '♦', name: 'diamonds', color: '#ea580c' }, // Clean orange diamonds
    { char: '♥', name: 'hearts', color: '#dc2626' }   // Clean red hearts
  ];

  private ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

  constructor() {
    this.init();
  }

  private async init() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.app = new Application();
    
    await this.app.init({
      canvas,
      resizeTo: window,
      antialias: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
    });

    this.tableGraphic = new Graphics();
    this.app.stage.addChild(this.tableGraphic);

    this.turnTimerGraphic = new Graphics();
    this.app.stage.addChild(this.turnTimerGraphic);

    this.deckContainer = new Container();
    this.app.stage.addChild(this.deckContainer);

    this.pileContainer = new Container();
    this.app.stage.addChild(this.pileContainer);

    this.playerContainer = new Container();
    this.app.stage.addChild(this.playerContainer);

    this.cardContainer = new Container();
    this.app.stage.addChild(this.cardContainer);

    this.resizeTable();
    window.addEventListener('resize', () => this.resizeTable());
    this.createBackgroundParticles();

    this.app.ticker.add((ticker) => {
      if (this.turnTimerActivePlayerId !== null && this.turnTimerRemaining > 0) {
        const elapsedSecs = ticker.elapsedMS / 1000;
        this.turnTimerRemaining -= elapsedSecs;
        if (this.turnTimerRemaining <= 0) {
          this.turnTimerRemaining = 0;
          this.turnTimerActivePlayerId = null;
          this.turnTimerGraphic.clear();
        } else {
          this.drawTurnCountdownRing();
        }
      }
    });
  }

  // Get dynamic card layout constraints based on screen size
  private getCardDimensions() {
    const w = this.app.screen.width;
    if (w < 768) {
      // Mobile phone layouts
      return {
        width: 50,
        height: 72,
        spacing: 26,  // Compact overlapping spacing
        offsetY: 80,  // Margin from screen bottom edge
        avatarRadius: 22,
        spotRadiusFactor: 0.42,
        nameFontSize: 10,
        statusFontSize: 8,
      };
    } else {
      // Desktop monitor layouts
      return {
        width: 80,
        height: 116,
        spacing: 84,  // Spaced out
        offsetY: 140, // Standard height
        avatarRadius: 30,
        spotRadiusFactor: 0.38,
        nameFontSize: 11,
        statusFontSize: 9,
      };
    }
  }

  private resizeTable() {
    if (!this.app || !this.app.renderer) return;

    // Force renderer to sync size with window inner dimension immediately
    this.app.renderer.resize(window.innerWidth, window.innerHeight);

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const dims = this.getCardDimensions();

    this.tableGraphic.clear();

    // Flat Outer table
    this.tableGraphic.circle(w / 2, h / 2, Math.min(w, h) * dims.spotRadiusFactor);
    this.tableGraphic.fill({ color: 0x14141a });
    this.tableGraphic.stroke({ width: 2, color: 0x272731 });

    // Flat Inner ring
    this.tableGraphic.circle(w / 2, h / 2, Math.min(w, h) * (dims.spotRadiusFactor - 0.03));
    this.tableGraphic.stroke({ width: 1, color: 0x1e1e28 });

    this.deckContainer.position.set(w / 2, h / 2 - 50);
    this.pileContainer.position.set(w / 2, h / 2 - 50);
    
    if (this.cardContainer) {
      const spotX = w < 768 ? 45 : 90;
      const leftBoundary = spotX + dims.avatarRadius + (w < 768 ? 10 : 20);
      const cardCenterX = (w + leftBoundary) / 2;
      this.cardContainer.position.set(cardCenterX, h - dims.offsetY);
      
      // Scale and fan cards in real-time
      const scale = dims.width / 80;
      const totalWidth = dims.spacing * (this.cards.length - 1);
      const startX = -totalWidth / 2;

      this.cards.forEach((card, index) => {
        card.container.scale.set(scale);
        const targetX = startX + index * dims.spacing;
        const targetY = card.isSelected ? -32 * scale : 0;
        card.container.position.set(targetX, targetY);
        card.container.rotation = (index - (this.cards.length - 1) / 2) * 0.04;
      });
    }

    // Refresh seat positions around center
    if (this.lastRoomPlayers.length > 0) {
      this.renderRoomState(
        this.lastRoomPlayers,
        this.lastReadyPlayers,
        this.lastActivePlayerId,
        this.lastCardCounts,
        this.lastPassedPlayers,
        this.lastSelfId,
        this.lastTurnLimitSeconds,
        this.lastSpectators
      );
    }

    // Refresh center pile cards
    if (this.lastPlayedCards.length > 0) {
      this.setLastPlayed(this.lastPlayedCards, this.lastPlayedById, false);
    }
  }

  private createBackgroundParticles() {
    const particleCount = 10;
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    for (let i = 0; i < particleCount; i++) {
      const p = new Graphics();
      const radius = Math.random() * 3 + 2;
      const opacity = Math.random() * 0.12 + 0.04;
      const color = Math.random() > 0.5 ? 0xdb2777 : 0x4f46e5;

      p.circle(0, 0, radius);
      p.fill({ color, alpha: opacity });
      
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      
      this.app.stage.addChildAt(p, 0);

      const speedX = (Math.random() - 0.5) * 0.2;
      const speedY = (Math.random() - 0.5) * 0.2;

      this.app.ticker.add((ticker) => {
        p.x += speedX * ticker.deltaTime;
        p.y += speedY * ticker.deltaTime;

        if (p.x < -10) p.x = this.app.screen.width + 10;
        if (p.x > this.app.screen.width + 10) p.x = -10;
        if (p.y < -10) p.y = this.app.screen.height + 10;
        if (p.y > this.app.screen.height + 10) p.y = -10;
      });
    }
  }

  private getPlayerColor(userId: number): number {
    const flatColors = [
      0x4f46e5, // indigo
      0x0891b2, // cyan
      0x0d9488, // teal
      0xeab308, // yellow
      0x2563eb, // blue
      0x7c3aed, // violet
      0xd946ef, // fuchsia
    ];
    return flatColors[userId % flatColors.length];
  }

  private createCard(cardVal: number) {
    const cardWidth = 80;
    const cardHeight = 116;
    const cContainer = new Container();
    
    cContainer.eventMode = 'static';
    cContainer.cursor = 'pointer';

    // Decode cardVal
    const rankIdx = Math.floor(cardVal / 4);
    const suitIdx = cardVal % 4;
    const rank = this.ranks[rankIdx];
    const suitObj = this.suits[suitIdx];

    // 1. Flat card background
    const bg = new Graphics();
    bg.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
    bg.fill({ color: 0xf8fafc }); // Slate 50
    bg.stroke({ width: 1.5, color: 0xe2e8f0 });
    cContainer.addChild(bg);

    // 2. Flat selection outline
    const glowBorder = new Graphics();
    glowBorder.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
    glowBorder.stroke({ width: 2.5, color: 0xdb2777 });
    glowBorder.alpha = 0;
    cContainer.addChild(glowBorder);

    const textStyle = new TextStyle({
      fontFamily: 'Outfit',
      fontSize: 22,
      fontWeight: 'bold',
      fill: suitObj.color,
    });

    const rankText = new Text({ text: rank, style: textStyle });
    rankText.anchor.set(0.5);
    rankText.position.set(-cardWidth / 2 + 18, -cardHeight / 2 + 18);
    cContainer.addChild(rankText);

    const suitStyleSmall = new TextStyle({
      fontFamily: 'Outfit',
      fontSize: 16,
      fill: suitObj.color,
    });
    const suitTextSmall = new Text({ text: suitObj.char, style: suitStyleSmall });
    suitTextSmall.anchor.set(0.5);
    suitTextSmall.position.set(-cardWidth / 2 + 18, -cardHeight / 2 + 35);
    cContainer.addChild(suitTextSmall);

    const suitStyleLarge = new TextStyle({
      fontFamily: 'Outfit',
      fontSize: 44,
      fill: suitObj.color,
    });
    const suitText = new Text({ text: suitObj.char, style: suitStyleLarge });
    suitText.anchor.set(0.5);
    suitText.position.set(8, 12);
    cContainer.addChild(suitText);

    const cardObj = {
      container: cContainer,
      bg,
      glowBorder,
      rankText,
      suitText,
      rank,
      suit: suitObj.char,
      color: suitObj.color,
      value: cardVal,
      isSelected: false,
      isDealt: false,
    };

    cContainer.on('pointerover', () => {
      const currentDims = this.getCardDimensions();
      const currentScale = currentDims.width / 80;
      if (!cardObj.isSelected && cardObj.isDealt) {
        gsap.to(cContainer, { y: -16 * currentScale, duration: 0.15, ease: 'power2.out' });
        glowBorder.tint = 0xdb2777;
        gsap.to(glowBorder, { alpha: 1, duration: 0.15 });
      }
    });

    cContainer.on('pointerout', () => {
      if (!cardObj.isSelected && cardObj.isDealt) {
        gsap.to(cContainer, { y: 0, duration: 0.15, ease: 'power2.out' });
        gsap.to(glowBorder, { alpha: 0, duration: 0.15 });
      }
    });

    cContainer.on('pointerdown', () => {
      if (!cardObj.isDealt) return;
      const currentDims = this.getCardDimensions();
      const currentScale = currentDims.width / 80;

      cardObj.isSelected = !cardObj.isSelected;
      
      const targetY = cardObj.isSelected ? -32 * currentScale : 0;
      gsap.to(cContainer, {
        y: targetY,
        duration: 0.2,
        ease: 'power2.out',
      });

      if (cardObj.isSelected) {
        glowBorder.tint = 0xd97706; // Amber
        gsap.to(glowBorder, { alpha: 1, duration: 0.2 });
      } else {
        gsap.to(glowBorder, { alpha: 0, duration: 0.2 });
      }
    });

    return cardObj;
  }

  // Set current player's hand cards and trigger deal animation
  public setHand(cardValues: number[], animate = true) {
    this.cards.forEach(c => this.cardContainer.removeChild(c.container));
    this.cards = [];

    if (cardValues.length === 0) return;

    // Sort hand values ascending by weight
    const sortedVals = [...cardValues].sort((a, b) => {
      const getW = (c: number) => {
        const r = Math.floor(c / 4);
        if (r === 12) return 15; // 2
        if (r === 11) return 14; // A
        return r + 3;
      };
      return getW(a) - getW(b);
    });

    const dims = this.getCardDimensions();
    const scale = dims.width / 80;

    sortedVals.forEach((val) => {
      const card = this.createCard(val);
      card.container.scale.set(scale);
      
      if (animate) {
        card.container.position.set(0, -this.app.screen.height / 2 + 100);
        card.container.rotation = (Math.random() - 0.5) * 0.2;
        card.container.alpha = 0;
      } else {
        card.isDealt = true;
      }

      this.cardContainer.addChild(card.container);
      this.cards.push(card);
    });

    const totalWidth = dims.spacing * (this.cards.length - 1);
    const startX = -totalWidth / 2;

    if (animate) {
      const tl = gsap.timeline();
      
      // Deal flying out from deck center
      this.cards.forEach((card, index) => {
        tl.to(card.container, {
          alpha: 1,
          rotation: 0,
          x: 0,
          y: -this.app.screen.height / 2 + 100,
          duration: 0.3,
          ease: 'power2.out',
        }, index * 0.015);
      });

      // Shake effect
      const shakeCenterY = -this.app.screen.height / 2 + 100;
      tl.to(this.cards.map(c => c.container), {
        x: () => (Math.random() - 0.5) * 12,
        y: () => shakeCenterY + (Math.random() - 0.5) * 12,
        rotation: () => (Math.random() - 0.5) * 0.1,
        duration: 0.06,
        repeat: 3,
        yoyo: true,
        ease: 'none',
      });

      // Fan out into player's area
      this.cards.forEach((card, index) => {
        const targetX = startX + index * dims.spacing;
        
        tl.to(card.container, {
          x: targetX,
          y: 0,
          rotation: (index - (this.cards.length - 1) / 2) * 0.04,
          duration: 0.45,
          ease: 'power2.out',
          onComplete: () => {
            card.isDealt = true;
          }
        }, `-=${index === 0 ? 0.15 : 0.4}`);
      });
    } else {
      // Reposition static hand
      this.cards.forEach((card, index) => {
        const targetX = startX + index * dims.spacing;
        card.container.position.set(targetX, 0);
        card.container.rotation = (index - (this.cards.length - 1) / 2) * 0.04;
      });
    }
  }

  // Get card values selected by the player
  public getSelectedCards(): number[] {
    return this.cards.filter(c => c.isSelected).map(c => c.value);
  }

  // Render all active room player spots in circular layout
  public renderRoomState(
    players: number[],
    readyPlayers: number[],
    activePlayerId: number | null,
    cardCounts: Record<number, number>,
    passedPlayers: number[],
    selfId: number,
    turnLimitSeconds = 15,
    spectators: number[] = []
  ) {
    // Cache inputs first
    this.lastRoomPlayers = players;
    this.lastReadyPlayers = readyPlayers;
    this.lastActivePlayerId = activePlayerId;
    this.lastCardCounts = cardCounts;
    this.lastPassedPlayers = passedPlayers;
    this.lastSelfId = selfId;
    this.lastTurnLimitSeconds = turnLimitSeconds;
    this.lastSpectators = spectators;

    // Handle timer initialization when active player changes
    if (activePlayerId === null) {
      this.turnTimerActivePlayerId = null;
      this.turnTimerRemaining = 0;
      if (this.turnTimerGraphic) {
        this.turnTimerGraphic.clear();
      }
    } else if (this.turnTimerActivePlayerId !== activePlayerId) {
      this.turnTimerActivePlayerId = activePlayerId;
      this.turnTimerRemaining = turnLimitSeconds;
      this.turnTimerDuration = turnLimitSeconds;
    }

    this.playerContainer.removeChildren();
    this.playerSpots.clear();

    if (players.length === 0) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const dims = this.getCardDimensions();
    const radius = Math.min(w, h) * dims.spotRadiusFactor;

    let selfIdx = players.indexOf(selfId);
    if (selfIdx === -1) selfIdx = 0;

    players.forEach((userId, i) => {
      // Relative seating index (0 = bottom self, clockwise distribution)
      const relativeIdx = (i - selfIdx + players.length) % players.length;
      
      const angle = Math.PI / 2 + (relativeIdx * 2 * Math.PI) / players.length;

      let spotX = w / 2 + Math.cos(angle) * radius;
      let spotY = h / 2 + Math.sin(angle) * radius;

      if (relativeIdx === 0) {
        // Shift bottom-self player spot to the bottom-left corner so it doesn't get covered by hand cards
        spotX = w < 768 ? 45 : 90;
        spotY = h - (w < 768 ? 55 : 85);
      }

      const spotContainer = new Container();
      spotContainer.position.set(spotX, spotY);

      // 1. Avatar circle background
      const avatarSize = dims.avatarRadius;
      const avatar = new Graphics();
      const color = this.getPlayerColor(userId);
      avatar.circle(0, 0, avatarSize);
      avatar.fill({ color });
      avatar.stroke({ width: 2, color: 0x272731 });
      spotContainer.addChild(avatar);

      // 2. Highlight border for Active Player
      if (activePlayerId === userId) {
        const activeOutline = new Graphics();
        activeOutline.circle(0, 0, avatarSize + 4);
        activeOutline.stroke({ width: 2, color: 0xdb2777 }); // Pink indicator
        spotContainer.addChild(activeOutline);

        gsap.fromTo(activeOutline.scale,
          { x: 1, y: 1 },
          { x: 1.08, y: 1.08, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }
        );
      }

      // 3. User initials
      const initials = userId === selfId ? 'Me' : `P${userId % 100}`;
      const initialsStyle = new TextStyle({
        fontFamily: 'Outfit',
        fontSize: w < 768 ? 13 : 16,
        fontWeight: 'bold',
        fill: 0xffffff,
      });
      const initialsText = new Text({ text: initials, style: initialsStyle });
      initialsText.anchor.set(0.5);
      initialsText.position.set(0, 0);
      spotContainer.addChild(initialsText);

      // 4. Display Name text
      const nameStyle = new TextStyle({
        fontFamily: 'Outfit',
        fontSize: dims.nameFontSize,
        fontWeight: 'bold',
        fill: userId === selfId ? 0xdb2777 : 0xe2e8f0,
      });
      const displayName = userId === selfId ? 'Bạn' : `Player_${userId}`;
      const nameText = new Text({ text: displayName, style: nameStyle });
      nameText.anchor.set(0.5);
      nameText.position.set(0, avatarSize + (w < 768 ? 10 : 14));
      spotContainer.addChild(nameText);

      // 5. Status message
      let statusStr = 'ĐANG CHỜ';
      let statusColor = 0x64748b; // Gray

      const isReady = readyPlayers.includes(userId);
      const isPassed = passedPlayers.includes(userId);
      const isSpectator = spectators.includes(userId);

      if (isSpectator) {
        statusStr = 'XEM CHƠI';
        statusColor = 0xa8a29e; // Stone / light gray
      } else if (isPassed) {
        statusStr = 'PASS';
        statusColor = 0xef4444; // Red
      } else if (isReady) {
        statusStr = 'SẴN SÀNG';
        statusColor = 0x10b981; // Green
      }

      const statusStyle = new TextStyle({
        fontFamily: 'Outfit',
        fontSize: dims.statusFontSize,
        fontWeight: 'bold',
        fill: statusColor,
      });
      const statusText = new Text({ text: statusStr, style: statusStyle });
      statusText.anchor.set(0.5);
      statusText.position.set(0, avatarSize + (w < 768 ? 20 : 26));
      spotContainer.addChild(statusText);

      // 6. Card Badge Pill
      const cardCount = cardCounts[userId] ?? 0;
      if (cardCount > 0) {
        const badge = new Container();
        badge.position.set(0, -avatarSize - 10);

        const badgeBg = new Graphics();
        badgeBg.roundRect(-18, -8, 36, 16, 4);
        badgeBg.fill({ color: 0x16161f });
        badgeBg.stroke({ width: 1, color: 0x2e2e3f });
        badge.addChild(badgeBg);

        const cardCountStyle = new TextStyle({
          fontFamily: 'Outfit',
          fontSize: w < 768 ? 8 : 10,
          fontWeight: 'bold',
          fill: 0xfacc15,
        });
        const cardCountText = new Text({ text: `🎴 ${cardCount}`, style: cardCountStyle });
        cardCountText.anchor.set(0.5);
        cardCountText.position.set(0, 0);
        badge.addChild(cardCountText);

        spotContainer.addChild(badge);
      }

      this.playerContainer.addChild(spotContainer);
      this.playerSpots.set(userId, spotContainer);
    });
  }

  // Display played card combination in the center pile
  public setLastPlayed(playedCards: number[], playedById: number | null, animate = true) {
    this.lastPlayedCards = playedCards;
    this.lastPlayedById = playedById;

    this.pileContainer.removeChildren();

    if (playedCards.length === 0) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const dims = this.getCardDimensions();

    const scale = (dims.width / 80) * 0.7; // Scale down significantly in the center pile
    const cardWidth = 80;
    const cardHeight = 116;
    
    const spacing = 26 * scale;
    const totalWidth = spacing * (playedCards.length - 1);
    const startX = -totalWidth / 2;

    // Get position to fly from
    let startXPos = 0;
    let startYPos = 0;
    if (playedById && this.playerSpots.has(playedById)) {
      const spot = this.playerSpots.get(playedById)!;
      startXPos = spot.x - w / 2;
      startYPos = spot.y - (h / 2 - 50);
    }

    playedCards.forEach((cardVal, index) => {
      const cContainer = new Container();

      // Flat Card background
      const bg = new Graphics();
      bg.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      bg.fill({ color: 0xf8fafc });
      bg.stroke({ width: 1.5, color: 0xe2e8f0 });
      cContainer.addChild(bg);

      // Decode rank & suit
      const rankIdx = Math.floor(cardVal / 4);
      const suitIdx = cardVal % 4;
      const rank = this.ranks[rankIdx];
      const suitObj = this.suits[suitIdx];

      const rankStyle = new TextStyle({
        fontFamily: 'Outfit',
        fontSize: 22,
        fontWeight: 'bold',
        fill: suitObj.color,
      });
      const rankText = new Text({ text: rank, style: rankStyle });
      rankText.anchor.set(0.5);
      rankText.position.set(-cardWidth / 2 + 18, -cardHeight / 2 + 18);
      cContainer.addChild(rankText);

      const suitStyle = new TextStyle({
        fontFamily: 'Outfit',
        fontSize: 44,
        fill: suitObj.color,
      });
      const suitText = new Text({ text: suitObj.char, style: suitStyle });
      suitText.anchor.set(0.5);
      suitText.position.set(8, 12);
      cContainer.addChild(suitText);

      // Target position inside center pile
      const targetX = startX + index * spacing;
      const targetY = (Math.random() - 0.5) * 8 * scale;
      const targetRot = (Math.random() - 0.5) * 0.12;

      this.pileContainer.addChild(cContainer);

      if (animate && playedById) {
        cContainer.position.set(startXPos, startYPos);
        cContainer.scale.set(scale * 0.35);
        cContainer.alpha = 0;

        gsap.to(cContainer, {
          x: targetX,
          y: targetY,
          rotation: targetRot,
          alpha: 1,
          duration: 0.45,
          ease: 'power2.out',
          delay: index * 0.035,
        });
        gsap.to(cContainer.scale, {
          x: scale,
          y: scale,
          duration: 0.45,
          ease: 'power2.out',
          delay: index * 0.035,
        });
      } else {
        cContainer.scale.set(scale);
        cContainer.position.set(targetX, targetY);
        cContainer.rotation = targetRot;
      }
    });
  }

  // Clear the table for a new game or round
  public clearTable(clearPlayers = true) {
    this.pileContainer.removeChildren();
    this.cards.forEach(c => this.cardContainer.removeChild(c.container));
    this.cards = [];
    this.lastPlayedCards = [];
    this.lastPlayedById = null;
    this.turnTimerActivePlayerId = null;
    this.turnTimerRemaining = 0;
    if (this.turnTimerGraphic) {
      this.turnTimerGraphic.clear();
    }

    if (clearPlayers) {
      this.playerContainer.removeChildren();
      this.playerSpots.clear();
      this.lastRoomPlayers = [];
      this.lastReadyPlayers = [];
      this.lastActivePlayerId = null;
      this.lastCardCounts = {};
      this.lastPassedPlayers = [];
      this.lastSelfId = 0;
      this.lastSpectators = [];
      this.lastTurnLimitSeconds = 15;
    }
  }

  // Remove specified cards from hand and realign
  public removeCardsFromHand(cardValues: number[]) {
    // 1. Remove PIXI containers of played cards
    this.cards.forEach(card => {
      if (cardValues.includes(card.value)) {
        this.cardContainer.removeChild(card.container);
      }
    });

    // 2. Filter out played cards from this.cards array
    this.cards = this.cards.filter(card => !cardValues.includes(card.value));

    // 3. Realign remaining cards fanned out
    const dims = this.getCardDimensions();
    const totalWidth = dims.spacing * (this.cards.length - 1);
    const startX = -totalWidth / 2;

    this.cards.forEach((card, index) => {
      const targetX = startX + index * dims.spacing;
      const targetY = card.isSelected ? -32 * (dims.width / 80) : 0;
      
      // Smoothly animate the fanned out remaining cards into their new slots
      gsap.to(card.container, {
        x: targetX,
        y: targetY,
        rotation: (index - (this.cards.length - 1) / 2) * 0.04,
        duration: 0.3,
        ease: 'power2.out'
      });
    });
  }

  // Temporary speech bubble notification for in-game statuses
  public showSpeechBubble(userId: number, text: string) {
    if (!this.playerSpots.has(userId)) return;

    const w = this.app.screen.width;
    const spot = this.playerSpots.get(userId)!;
    
    // Clear duplicates
    const existingBubble = spot.getChildByName('bubble');
    if (existingBubble) {
      spot.removeChild(existingBubble);
    }

    const bubble = new Container();
    bubble.name = 'bubble';
    
    const bubbleOffset = w < 768 ? -50 : -65;
    bubble.position.set(0, bubbleOffset);

    const txtStyle = new TextStyle({
      fontFamily: 'Outfit',
      fontSize: w < 768 ? 9 : 10,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    const txt = new Text({ text, style: txtStyle });
    txt.anchor.set(0.5);

    const bubbleW = Math.max(45, txt.width + 12);
    const bubbleH = w < 768 ? 18 : 22;

    const bg = new Graphics();
    bg.roundRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 4);
    bg.fill({ color: 0xdb2777 }); // Sleek flat pink
    // triangle pointing down
    bg.poly([-4, bubbleH / 2, 4, bubbleH / 2, 0, bubbleH / 2 + 4]);
    bg.fill({ color: 0xdb2777 });

    bubble.addChild(bg);
    bubble.addChild(txt);

    spot.addChild(bubble);

    gsap.from(bubble, {
      y: bubbleOffset + 10,
      alpha: 0,
      duration: 0.25,
      ease: 'back.out(1.5)',
    });

    // Fade out after 2.5s
    gsap.to(bubble, {
      alpha: 0,
      duration: 0.3,
      delay: 2.2,
      onComplete: () => {
        if (spot.children.includes(bubble)) {
          spot.removeChild(bubble);
        }
      }
    });
  }

  // Interactive sandbox presentation wrapper
  public shuffleAndDeal() {
    const mockVals: number[] = [];
    while (mockVals.length < 10) {
      const v = Math.floor(Math.random() * 52);
      if (!mockVals.includes(v)) {
        mockVals.push(v);
      }
    }
    this.setHand(mockVals, true);
  }

  // Draw radial progress timer ring around active player's spot
  private drawTurnCountdownRing() {
    if (!this.turnTimerGraphic) return;
    this.turnTimerGraphic.clear();

    if (this.turnTimerActivePlayerId === null || this.turnTimerRemaining <= 0) {
      return;
    }

    const spot = this.playerSpots.get(this.turnTimerActivePlayerId);
    if (!spot) return;

    const dims = this.getCardDimensions();
    const radius = dims.avatarRadius + 4;
    const progress = this.turnTimerRemaining / this.turnTimerDuration; // 1.0 down to 0.0

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + progress * 2 * Math.PI;

    let color = 0x10b981; // Green
    if (progress < 0.2) {
      color = 0xef4444; // Red
    } else if (progress < 0.5) {
      color = 0xf59e0b; // Amber
    }

    this.turnTimerGraphic.arc(spot.x, spot.y, radius, startAngle, endAngle);
    this.turnTimerGraphic.stroke({ width: 3, color });
  }
}
