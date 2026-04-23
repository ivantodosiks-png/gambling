// Blackjack Game Engine
const BJ = (() => {
  const state = {
    currentRoom: null,
    currentPlayer: null,
    rooms: [],
    gameInProgress: false,
    subscription: null,
    playersSubscription: null,
    roomPollTimer: 0,
    currentRoomStatus: null,
    nextRoundTimer: 0,
    actionInFlight: false,
    actionHints: {}, // { [playerId]: { text: string, until: number } }
    lastPlayerSnapshot: {}, // { [playerId]: { handSig: string, status: string, bet: number } }
  };

  // Helper function to get current user profile
  const getProfile = async () => {
    try {
      const client = window.sb || (typeof sb !== "undefined" ? sb : null);
      if (!client) {
        console.error("❌ Supabase client not found (window.sb).");
        return null;
      }

      // 1) Supabase Auth session (main flow)
      let currentUser = null;
      try {
        const { data } = await client.auth.getSession();
        currentUser = data?.session?.user || null;
      } catch {}

      // 2) Fallback: legacy local auth (auth.js)
      if (!currentUser) {
        const storedUser = localStorage.getItem("gambling_current_user");
        console.log("📦 storedUser из localStorage:", storedUser);
        if (!storedUser) {
          console.error("❌ Пользователь не авторизован (нет session и нет localStorage)");
          return null;
        }
        try {
          currentUser = JSON.parse(storedUser);
        } catch {
          console.error("❌ Ошибка чтения пользователя из localStorage");
          return null;
        }
      }

      console.log("👤 currentUser:", currentUser);

      if (!currentUser?.id) {
        console.error("❌ Нет ID пользователя");
        return null;
      }

      console.log("🔍 Ищем профиль для user_id:", currentUser.id);

      // Получаем профиль из Supabase
      const { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      console.log('📊 Результат запроса profiles:', { profile, error });

      // Если профиль не найден, создаём его
      if (error || !profile) {
        console.warn('⚠️ Профиль не найден, создаём новый...');

        const email = String(currentUser.email || currentUser.user_metadata?.email || "").trim();
        const usernameFromEmail = email && email.includes("@") ? email.split("@")[0].slice(0, 24) : "";
        const username = String(currentUser.username || currentUser.user_metadata?.username || usernameFromEmail || "Player").trim().slice(0, 24);

        const newProfile = {
          id: currentUser.id,
          email: email || 'unknown@email.com',
          username,
          balance: 5000,
        };

        console.log('➕ Создаём новый профиль:', newProfile);

        const { data: created, error: insertError } = await client
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        console.log('➕ Результат вставки:', { created, insertError });

        if (insertError) {
          console.error('❌ Ошибка создания профиля:', insertError);
          // Пробуем ещё раз получить профиль (может быть конфликт)
          const { data: existing } = await client
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          console.log('🔄 Повторный запрос профиля:', existing);
          return existing || null;
        }

        console.log('✅ Профиль создан успешно:', created);
        return created;
      }
      
      console.log('✅ Профиль найден:', profile);
      return profile;
    } catch (error) {
      console.error('❌ Критическая ошибка в getProfile:', error);
      return null;
    }
  };

  const CARD_SUITS = ['♠', '♥', '♣', '♦'];
  const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const fetchPlayersWithProfiles = async (roomId) => {
    // Preferred: join profiles if a FK relationship exists.
    const joined = await sb
      .from('blackjack_players')
      .select('*, profiles ( username )')
      .eq('room_id', roomId);

    if (!joined?.error && Array.isArray(joined?.data)) return joined.data;

    // Fallback: fetch players, then fetch profiles separately and stitch.
    const base = await sb.from('blackjack_players').select('*').eq('room_id', roomId);
    if (base?.error) throw base.error;

    const players = Array.isArray(base?.data) ? base.data : [];
    const ids = [...new Set(players.map((p) => p.player_id).filter(Boolean))];

    let byId = {};
    if (ids.length) {
      const profRes = await sb.from('profiles').select('id, username').in('id', ids);
      if (!profRes?.error && Array.isArray(profRes?.data)) {
        byId = profRes.data.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }
    }

    return players.map((p) => ({ ...p, profiles: byId[p.player_id] || null }));
  };

  // ============ DECK FUNCTIONS ============
  const createDeck = () => {
    const deck = [];
    for (let suit of CARD_SUITS) {
      for (let value of CARD_VALUES) {
        deck.push({ value, suit });
      }
    }
    return shuffleDeck(deck);
  };

  const shuffleDeck = (deck) => {
    const randomInt = (maxExclusive) => {
      if (!maxExclusive || maxExclusive <= 0) return 0;
      const cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
      if (!cryptoObj) return Math.floor(Math.random() * maxExclusive);

      // Rejection sampling to avoid modulo bias.
      const range = 0x100000000; // 2^32
      const limit = range - (range % maxExclusive);
      const buf = new Uint32Array(1);
      while (true) {
        cryptoObj.getRandomValues(buf);
        const x = buf[0];
        if (x < limit) return x % maxExclusive;
      }
    };

    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const cardValue = (card) => {
    if (card.value === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    return parseInt(card.value);
  };

  const calculateHandScore = (hand) => {
    let score = 0;
    let aces = 0;
    
    for (let card of hand) {
      const val = cardValue(card);
      score += val;
      if (card.value === 'A') aces++;
    }
    
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    
    return score;
  };

  const formatCard = (card) => {
    return `${card.value}${card.suit}`;
  };

  // ============ UI FUNCTIONS ============
  const renderRoomsList = async () => {
    try {
      console.log('📋 Загружаем список комнат...');
      
      const response = await sb.rpc('get_available_blackjack_rooms', { p_limit: 50 });
      
      console.log('Ответ от RPC:', response);
      
      if (response.error) {
        console.error('❌ Ошибка RPC:', response.error);
        showMessage('bjLobbyMsg', `Failed to load rooms: ${response.error.message}`, 'error');
        return;
      }

      const rooms = response.data || response || [];
      console.log('✅ Комнат найдено:', rooms.length);
      
      const list = document.getElementById('bjRoomsList');
      list.innerHTML = '';
      
      if (!rooms || rooms.length === 0) {
        list.innerHTML = '<div class="bj-room-item" style="cursor:auto; color: var(--muted);">No available rooms</div>';
        return;
      }
      
      for (let room of rooms) {
        const item = document.createElement('div');
        item.className = 'bj-room-item';
        item.innerHTML = `
          <div>
            <div style="font-weight: 600;">Room ${room.id.substring(0, 8)}</div>
            <div style="font-size: 12px; color: var(--muted);">Min bet: ${room.min_bet} | Players: ${room.current_players}/${room.max_players}</div>
          </div>
          <button class="secondary" type="button" onclick="BJ.joinRoom('${room.id}')">Join</button>
        `;
        list.appendChild(item);
      }
    } catch (error) {
      console.error('❌ Критическая ошибка renderRoomsList:', error);
      showMessage('bjLobbyMsg', `Error: ${error.message}`, 'error');
    }
  };

  const showMessage = (elementId, message, type = 'info') => {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.className = `msg show ${type}`;
      setTimeout(() => el.classList.remove('show'), 4000);
    }
  };

  const setWaitingRoomId = (roomId) => {
    const el = document.getElementById('bjWaitingRoomId');
    if (el) el.textContent = roomId || '-';
  };

  const copyRoomId = async () => {
    const id = state.currentRoom || '';
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      showMessage('bjWaitingMsg', 'Room ID copied', 'success');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = id;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showMessage('bjWaitingMsg', 'Room ID copied', 'success');
      } catch {
        showMessage('bjWaitingMsg', 'Copy failed', 'error');
      }
    }
  };

  const formatCardDisplay = (card) => {
    const display = document.createElement('div');
    display.className = `bj-card-item ${['♥', '♦'].includes(card.suit) ? 'red' : 'black'}`;
    display.textContent = formatCard(card);
    return display;
  };

  const formatHiddenCard = () => {
    const display = document.createElement('div');
    display.className = 'bj-card-item hidden';
    return display;
  };

  const renderDealerHand = (cards, hideHoleCard = false) => {
    const container = document.getElementById('bjDealerHand');
    if (!container) return;

    const sig = JSON.stringify({ hideHoleCard: !!hideHoleCard, cards: (cards || []).map((c) => `${c?.value || ''}${c?.suit || ''}`) });
    if (container.dataset && container.dataset.sig === sig) return;
    if (container.dataset) container.dataset.sig = sig;
    container.innerHTML = '';
    
    for (let i = 0; i < cards.length; i++) {
      // Standard blackjack: hide the dealer's second (hole) card during play.
      if (hideHoleCard && i === 1) {
        container.appendChild(formatHiddenCard());
      } else {
        container.appendChild(formatCardDisplay(cards[i]));
      }
    }
  };

  const setBettingLockedUI = (locked) => {
    const betInput = document.getElementById('bjBetInput');
    const betBtn = document.getElementById('bjConfirmBetBtn');
    if (betInput) betInput.disabled = !!locked;
    if (betBtn) betBtn.disabled = !!locked;
  };

  const setControlsDisabled = (disabled) => {
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');
    if (hitBtn) hitBtn.disabled = !!disabled;
    if (standBtn) standBtn.disabled = !!disabled;
    if (doubleBtn) doubleBtn.disabled = !!disabled;
  };

  const setControlsBusy = (busy) => {
    state.actionInFlight = !!busy;
    setControlsDisabled(!!busy);
  };

  const updateActionHints = (playersWithParsedHands) => {
    const now = Date.now();
    const prev = state.lastPlayerSnapshot || {};
    const next = {};

    for (const p of playersWithParsedHands || []) {
      const pid = String(p.player_id || '');
      if (!pid) continue;
      const handArr = Array.isArray(p.hand) ? p.hand : [];
      const handSig = JSON.stringify(handArr.map((c) => `${c?.value || ''}${c?.suit || ''}`));
      const status = String(p.status || '');
      const bet = Math.floor(Number(p.bet || 0));
      next[pid] = { handSig, status, bet };

      const prevSnap = prev[pid];
      if (!prevSnap) continue;

      let hint = '';
      if (prevSnap.status !== status) {
        if (status === 'stand') hint = 'STAND';
        else if (status === 'bust') hint = 'BUST';
        else if (status === 'blackjack') hint = 'BLACKJACK';
      } else if (prevSnap.handSig !== handSig) {
        hint = bet > prevSnap.bet ? 'DOUBLE' : 'HIT';
      }

      if (hint) state.actionHints[pid] = { text: hint, until: now + 2200 };
    }

    for (const pid of Object.keys(state.actionHints || {})) {
      const h = state.actionHints[pid];
      if (!h || h.until <= now) delete state.actionHints[pid];
    }

    state.lastPlayerSnapshot = next;
  };

  const renderPlayersArea = (gameState) => {
    const container = document.getElementById('bjPlayersArea');
    if (!container) return;
    
    if (!gameState.players || gameState.players.length === 0) {
      container.innerHTML = '<div style="text-align:center; color: var(--muted); padding: 20px;">No players yet</div>';
      return;
    }

    const existingById = new Map();
    for (const el of Array.from(container.querySelectorAll('[data-player-id]'))) {
      const pid = el.getAttribute('data-player-id');
      if (pid) existingById.set(pid, el);
    }

    const keep = new Set();

    for (let player of gameState.players) {
      const pid = String(player.player_id || '');
      if (!pid) continue;
      keep.add(pid);

      let seat = existingById.get(pid);
      const isNew = !seat;
      if (!seat) {
        seat = document.createElement('div');
        seat.className = 'bj-player-seat';
        seat.setAttribute('data-player-id', pid);
        seat.innerHTML = `
          <div class="bj-player-name" data-name></div>
          <div class="bj-player-hand" data-hand></div>
          <div class="bj-player-info" data-info></div>
        `;
      }

      const nameEl = seat.querySelector('[data-name]');
      const handEl = seat.querySelector('[data-hand]');
      const infoEl = seat.querySelector('[data-info]');

      const parsedHand = Array.isArray(player.hand) ? player.hand : (typeof player.hand === 'string' ? JSON.parse(player.hand || '[]') : []);
      const score = calculateHandScore(parsedHand);
      const statusText = String(player.status || '').toUpperCase();
      const actionHint = state.actionHints[pid];
      const hintText = actionHint && actionHint.until > Date.now() ? actionHint.text : '';

      if (nameEl) {
        const baseName = player.profiles?.username || player.username || 'Player';
        const statusBadge = statusText && statusText !== 'PLAYING'
          ? ` <span style="margin-left:8px; font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:rgba(233,237,247,0.72);">${statusText}</span>`
          : '';
        const hintBadge = hintText
          ? ` <span style="margin-left:8px; font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:rgba(233,237,247,0.88);">${hintText}</span>`
          : '';
        const html = `${String(baseName).replace(/</g, '&lt;')}${statusBadge}${hintBadge}`;
        if (nameEl.innerHTML !== html) nameEl.innerHTML = html;
      }

      if (handEl) {
        const handSig = JSON.stringify((parsedHand || []).map((c) => `${c?.value || ''}${c?.suit || ''}`));
        if (handEl.dataset.sig !== handSig) {
          handEl.dataset.sig = handSig;
          handEl.innerHTML = '';
          if (Array.isArray(parsedHand) && parsedHand.length > 0) {
            const frag = document.createDocumentFragment();
            for (let card of parsedHand) frag.appendChild(formatCardDisplay(card));
            handEl.appendChild(frag);
          }
        }
      }

      if (infoEl) {
        const bet = Math.floor(Number(player.bet || 0));
        const infoSig = JSON.stringify({ score, bet });
        if (infoEl.dataset.sig !== infoSig) {
          infoEl.dataset.sig = infoSig;
          infoEl.innerHTML = `
            <div>Score: <b>${score}</b></div>
            <div>Bet: <b>${bet}</b></div>
          `;
        }
      }

      if (isNew) container.appendChild(seat);
    }

    for (const [pid, el] of existingById.entries()) {
      if (!keep.has(pid)) el.remove();
    }
  };

  // ============ ROOM FUNCTIONS ============
  const createRoom = async () => {
    try {
      console.log('🚀 Начинаем создание комнаты...');
      console.log('sb доступен?', !!sb);
      
      const profile = await getProfile();
      console.log('📋 getProfile вернул:', profile);
      
      if (!profile) {
        showMessage('bjLobbyMsg', 'Error: could not load profile. Please refresh.', 'error');
        return;
      }

      const minBet = parseInt(document.getElementById('bjMinBetInput').value) || 10;
      if (minBet < 1) {
        showMessage('bjLobbyMsg', 'Minimum bet must be at least 1', 'error');
        return;
      }

      const deck = createDeck();
      const roomId = crypto.randomUUID ? crypto.randomUUID() : 'room_' + Date.now();

      console.log('🎲 Созданы параметры комнаты:', { roomId, minBet, hostId: profile.id });

      const { data: createdRoom, error } = await sb
        .from('blackjack_rooms')
        .insert({
          id: roomId,
          host_id: profile.id,
          status: 'waiting',
          min_bet: minBet,
          max_players: 5,
          current_players: 1,
          deck: JSON.stringify(deck),
          dealer_hand: JSON.stringify([]),
          dealer_score: 0,
          round_number: 0,
        })
        .select();

      console.log('📤 Ответ insert blackjack_rooms:', { createdRoom, error });

      if (error) {
        console.error('❌ Ошибка вставки комнаты:', error);
        showMessage('bjLobbyMsg', `Failed to create room: ${error.message}`, 'error');
        return;
      }

      console.log('✅ Комната создана:', createdRoom);

      const { data: playerData, error: playerError } = await sb
        .from('blackjack_players')
        .insert({
          room_id: roomId,
          player_id: profile.id,
          bet: 0,
          hand: JSON.stringify([]),
          score: 0,
          status: 'waiting',
          result: null,
          winnings: 0,
          seat_position: 0,
        })
        .select();

      console.log('📤 Ответ insert blackjack_players:', { playerData, playerError });

      if (playerError) {
        console.error('❌ Ошибка вставки игрока:', playerError);
        showMessage('bjLobbyMsg', `Failed to add player: ${playerError.message}`, 'error');
        return;
      }

      console.log('✅ Игрок добавлен:', playerData);

      state.currentRoom = roomId;
      state.currentPlayer = profile.id;
      state.currentRoomStatus = 'waiting';

      showMessage('bjLobbyMsg', 'Room created! Waiting for other players...', 'success');
      showLobby(false);
      showWaitingRoom(true);
      setWaitingRoomId(roomId);
      renderWaitingRoom(roomId);

      subscribeToRoom(roomId);
    } catch (error) {
      console.error('❌ Критическая ошибка создания комнаты:', error);
      showMessage('bjLobbyMsg', `Critical error: ${error.message}`, 'error');
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const profile = await getProfile();
      if (!profile) {
        showMessage('bjLobbyMsg', 'Error: Could not get profile', 'error');
        return;
      }

      const { data: room, error: roomError } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        showMessage('bjLobbyMsg', 'Room not found', 'error');
        return;
      }

      if (room.current_players >= room.max_players) {
        showMessage('bjLobbyMsg', 'Room is full', 'error');
        return;
      }

      if (room.status !== 'waiting') {
        showMessage('bjLobbyMsg', 'Game already in progress', 'error');
        return;
      }

      const nextSeat = room.current_players;
      const { error: insertError } = await sb
        .from('blackjack_players')
        .insert({
          room_id: roomId,
          player_id: profile.id,
          bet: 0,
          hand: JSON.stringify([]),
          score: 0,
          status: 'waiting',
          result: null,
          winnings: 0,
          seat_position: nextSeat,
        });

      if (insertError) throw insertError;

      state.currentRoom = roomId;
      state.currentPlayer = profile.id;
      state.currentRoomStatus = 'waiting';

      showMessage('bjLobbyMsg', 'Joined room!', 'success');
      showLobby(false);
      showWaitingRoom(true);
      setWaitingRoomId(roomId);
      renderWaitingRoom(roomId);

      subscribeToRoom(roomId);
    } catch (error) {
      console.error('Error joining room:', error);
      showMessage('bjLobbyMsg', 'Error joining room', 'error');
    }
  };

  const joinRoomByInput = async () => {
    const roomId = document.getElementById('bjRoomIdInput').value.trim();
    if (!roomId) {
      showMessage('bjLobbyMsg', 'Please enter a room ID', 'error');
      return;
    }
    await joinRoom(roomId);
  };

  const leaveRoom = async () => {
    if (!state.currentRoom) return;

    try {
      const profile = await getProfile();
      if (profile) {
        const { data: room } = await sb
          .from('blackjack_rooms')
          .select('host_id')
          .eq('id', state.currentRoom)
          .maybeSingle();

        const isHost = !!(room && room.host_id === profile.id);

        // Remove self from the room.
        await sb
          .from('blackjack_players')
          .delete()
          .eq('room_id', state.currentRoom)
          .eq('player_id', profile.id);

        // If host leaves: close the whole lobby immediately (cascades players).
        // Otherwise DB triggers will keep current_players synced and auto-delete empty rooms.
        if (isHost) {
          await sb
            .from('blackjack_rooms')
            .delete()
            .eq('id', state.currentRoom);
        }
      }

      state.currentRoom = null;
      state.currentPlayer = null;
      state.currentRoomStatus = null;
      if (state.nextRoundTimer) {
        clearTimeout(state.nextRoundTimer);
        state.nextRoundTimer = 0;
      }
      setWaitingRoomId('-');
      showLobby(true);
      showWaitingRoom(false);
      showGameTable(false);

      if (state.subscription) {
        state.subscription.unsubscribe();
        state.subscription = null;
      }
      if (state.playersSubscription) {
        state.playersSubscription.unsubscribe();
        state.playersSubscription = null;
      }
      clearInterval(state.roomPollTimer);
      state.roomPollTimer = 0;
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const handleRoomUpdate = async (room) => {
    if (!room) return;
    state.currentRoomStatus = room.status || null;

    // Always keep short ID visible on table header.
    const roomIdEl = document.getElementById('bjCurrentRoomId');
    if (roomIdEl) roomIdEl.textContent = String(room.id || '').slice(0, 8);

    if (room.status === 'waiting') {
      showGameTable(false);
      showWaitingRoom(true);
      setWaitingRoomId(room.id);
      await renderWaitingRoom(room.id);
      return;
    }

    // betting: show table with bet input for everyone
    if (room.status === 'betting') {
      showWaitingRoom(false);
      showGameTable(true);
      await startGameView(room);
      return;
    }

    // playing/results: show table and render actual state
    if (room.status === 'playing' || room.status === 'results') {
      showWaitingRoom(false);
      showGameTable(true);
      document.getElementById('bjBettingPhase').style.display = 'none';
      document.getElementById('bjControls').style.display = room.status === 'results' ? 'none' : 'flex';
      await renderGameState(room.id);
      if (room.status === 'results') await showGameResults(room.id);
      return;
    }
  };

  const syncRoomOnce = async (roomId) => {
    try {
      const { data: room, error } = await sb.from('blackjack_rooms').select().eq('id', roomId).maybeSingle();
      if (error) throw error;
      if (!room) {
        if (state.currentRoom === roomId) forceExitRoom('Room closed by host.');
        return;
      }
      await handleRoomUpdate(room);
    } catch (e) {
      console.warn('syncRoomOnce error:', e?.message || e);
    }
  };

  const subscribeToRoom = (roomId) => {
    // Cleanup previous subs/timers
    if (state.subscription) {
      state.subscription.unsubscribe();
      state.subscription = null;
    }
    if (state.playersSubscription) {
      state.playersSubscription.unsubscribe();
      state.playersSubscription = null;
    }
    clearInterval(state.roomPollTimer);
    state.roomPollTimer = 0;

    // Realtime (if enabled)
    state.subscription = sb
      .channel(`bj_room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blackjack_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload?.eventType === 'DELETE') {
          forceExitRoom('Room closed by host.');
          return;
        }
        if (payload?.new) handleRoomUpdate(payload.new);
      })
      .subscribe();

    state.playersSubscription = sb
      .channel(`bj_players:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blackjack_players', filter: `room_id=eq.${roomId}` }, async () => {
        // Update the visible view based on current room status
        if (state.currentRoomStatus === 'waiting') await renderWaitingRoom(roomId);
        if (state.currentRoomStatus === 'betting') {
          const { data: room } = await sb.from('blackjack_rooms').select().eq('id', roomId).maybeSingle();
          if (room) await startGameView(room);
        }
        if (state.currentRoomStatus === 'playing' || state.currentRoomStatus === 'results') await renderGameState(roomId);
      })
      .subscribe();

    // Poll fallback (works even if Realtime выключен)
    state.roomPollTimer = setInterval(() => {
      if (state.currentRoom === roomId) syncRoomOnce(roomId);
    }, 1500);

    // Initial sync
    syncRoomOnce(roomId);
  };

  const renderWaitingRoom = async (roomId) => {
    try {
      const players = await fetchPlayersWithProfiles(roomId);

      const list = document.getElementById('bjWaitingPlayersList');
      list.innerHTML = '';

      for (let p of players || []) {
        const item = document.createElement('div');
        item.className = 'bj-player-waiting-item ' + (p.status === 'ready' ? 'ready' : '');
        item.textContent = p.profiles?.username || 'Player';
        list.appendChild(item);
      }

      const { data: room } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', roomId)
        .single();

      const profile = await getProfile();
      const isHost = room && profile && room.host_id === profile.id;
      const startBtn = document.getElementById('bjStartGameBtn');

      if (startBtn) {
        startBtn.style.display = isHost ? 'block' : 'none';
        startBtn.onclick = () => startGame(roomId);
      }
    } catch (error) {
      console.error('Error rendering waiting room:', error);
    }
  };

  const markReady = async () => {
    if (!state.currentRoom) return;

    try {
      const profile = await getProfile();
      if (profile) {
        const { data: player } = await sb
          .from('blackjack_players')
          .select()
          .eq('room_id', state.currentRoom)
          .eq('player_id', profile.id)
          .single();

        const newStatus = player?.status === 'ready' ? 'waiting' : 'ready';

        await sb
          .from('blackjack_players')
          .update({ status: newStatus })
          .eq('room_id', state.currentRoom)
          .eq('player_id', profile.id);

        renderWaitingRoom(state.currentRoom);
      }
    } catch (error) {
      console.error('Error marking ready:', error);
    }
  };

  const startGame = async (roomId) => {
    try {
      const { data: room, error: roomError } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      if (room.current_players < 2) {
        showMessage('bjWaitingMsg', 'Need at least 2 players to start', 'error');
        return;
      }

      const { data: players } = await sb.from('blackjack_players').select('status').eq('room_id', roomId);
      const everyoneReady = (players || []).every((p) => p.status === 'ready');
      if (!everyoneReady) {
        showMessage('bjWaitingMsg', 'All players must press Ready', 'error');
        return;
      }

      await sb
        .from('blackjack_rooms')
        .update({ status: 'betting', round_number: Number(room.round_number || 0) + 1 })
        .eq('id', roomId);

      renderWaitingRoom(roomId);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  // ============ GAME VIEW FUNCTIONS ============
  const showLobby = (show) => {
    document.getElementById('bjLobby').style.display = show ? 'block' : 'none';
  };

  const showWaitingRoom = (show) => {
    document.getElementById('bjWaitingRoom').style.display = show ? 'flex' : 'none';
  };

  const showGameTable = (show) => {
    document.getElementById('bjTable').style.display = show ? 'flex' : 'none';
  };

  const startGameView = async (room) => {
    try {
      const players = await fetchPlayersWithProfiles(room.id);

      document.getElementById('bjCurrentRoomId').textContent = room.id.substring(0, 8);
      document.getElementById('bjPlayerCount').textContent = `${players?.length || 0}/${room.max_players}`;

      // Show betting phase for all players
      document.getElementById('bjBettingPhase').style.display = 'block';
      document.getElementById('bjControls').style.display = 'none';
      document.getElementById('bjGameMsg').innerHTML = '';
      const betInput = document.getElementById('bjBetInput');
      if (betInput) betInput.min = String(room.min_bet || 10);

      renderPlayersArea({ players: players || [] });
      renderDealerHand([]);

      const profile = await getProfile();
      const me = profile ? (players || []).find((p) => p.player_id === profile.id) : null;
      setBettingLockedUI(!!me?.bet);
    } catch (error) {
      console.error('Error starting game view:', error);
    }
  };

  const confirmBet = async () => {
    if (!state.currentRoom) return;

    try {
      const profile = await getProfile();
      if (!profile) throw new Error('No profile');

      const { data: currentPlayerRow, error: currentPlayerErr } = await sb
        .from('blackjack_players')
        .select('bet, status')
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id)
        .maybeSingle();
      if (currentPlayerErr) throw currentPlayerErr;
      if (currentPlayerRow?.bet > 0) {
        setBettingLockedUI(true);
        showMessage('bjBettingMsg', 'Bet already locked', 'error');
        return;
      }

      const bet = parseInt(document.getElementById('bjBetInput').value, 10);
      if (!Number.isFinite(bet) || bet <= 0) {
        showMessage('bjBettingMsg', 'Enter a valid bet', 'error');
        return;
      }
      const { data: room } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', state.currentRoom)
        .single();

      if (bet < room.min_bet) {
        showMessage('bjBettingMsg', `Minimum bet is ${room.min_bet}`, 'error');
        return;
      }

      if (profile.balance < bet) {
        showMessage('bjBettingMsg', 'Insufficient balance', 'error');
        return;
      }

      // Update player bet
      await sb
        .from('blackjack_players')
        .update({ bet: bet, status: 'betting' })
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id);
      setBettingLockedUI(true);

      // Check if all players have bet
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', state.currentRoom);

      const allBet = players.every(p => p.bet > 0);
      if (allBet) {
        const isHost = room && room.host_id === profile.id;
        if (isHost) startRound(state.currentRoom, room);
      }

      showMessage('bjBettingMsg', 'Bet confirmed!', 'success');
    } catch (error) {
      console.error('Error confirming bet:', error);
      showMessage('bjBettingMsg', 'Error placing bet', 'error');
    }
  };

  const startRound = async (roomId, room) => {
    try {
      const { data: latestRoom, error: latestRoomErr } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', roomId)
        .single();
      if (latestRoomErr) throw latestRoomErr;
      if (!latestRoom || latestRoom.status !== 'betting') return;

      const deck = createDeck();
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', roomId);

      // Deal cards
      for (let p of players) {
        const initialHand = [deck[0], deck[1]];
        const initialScore = calculateHandScore(initialHand);
        const initialStatus = initialScore === 21 ? 'blackjack' : 'playing';
        await sb
          .from('blackjack_players')
          .update({
            hand: JSON.stringify(initialHand),
            score: initialScore,
            status: initialStatus,
          })
          .eq('room_id', roomId)
          .eq('player_id', p.player_id);
        deck.shift();
        deck.shift();
      }

      const dealerHand = [deck[0], deck[1]];
      deck.shift();
      deck.shift();

      await sb
        .from('blackjack_rooms')
        .update({
          status: 'playing',
          deck: JSON.stringify(deck),
          dealer_hand: JSON.stringify(dealerHand),
          dealer_score: calculateHandScore(dealerHand),
        })
        .eq('id', roomId);

      document.getElementById('bjBettingPhase').style.display = 'none';
      document.getElementById('bjControls').style.display = 'flex';
      renderGameState(roomId);
      checkRoundEnd(roomId);
    } catch (error) {
      console.error('Error starting round:', error);
    }
  };

  const renderGameState = async (roomId) => {
    try {
      const { data: room } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', roomId)
        .single();

      const players = await fetchPlayersWithProfiles(roomId);

      const dealerHand = typeof room.dealer_hand === 'string' ? JSON.parse(room.dealer_hand) : room.dealer_hand;
      const revealDealer = room.status === 'results' || room.status === 'finished';
      renderDealerHand(dealerHand, !revealDealer);
      const visibleScore = revealDealer ? calculateHandScore(dealerHand) : calculateHandScore([dealerHand[0]]);
      document.getElementById('bjDealerScore').textContent = String(visibleScore || 0);

      const playersWithParsedHands = players.map(p => ({
        ...p,
        hand: typeof p.hand === 'string' ? JSON.parse(p.hand) : p.hand
      }));
      updateActionHints(playersWithParsedHands);
      renderPlayersArea({ players: playersWithParsedHands });

      const profile = await getProfile();
      const currentPlayer = playersWithParsedHands.find(p => p.player_id === profile.id);
      if (currentPlayer) {
        document.getElementById('bjCurrentPlayerName').textContent = currentPlayer.profiles?.username || 'You';
        document.getElementById('bjCurrentPlayerScore').textContent = currentPlayer.score;
      }

      if (state.actionInFlight) return;
      if (!currentPlayer) return setControlsDisabled(true);
      const canAct = room && room.status === 'playing' && currentPlayer.status === 'playing';
      setControlsDisabled(!canAct);
    } catch (error) {
      console.error('Error rendering game state:', error);
    }
  };

  const hit = async () => {
    if (!state.currentRoom) return;
    if (state.actionInFlight) return;

    try {
      setControlsBusy(true);
      const profile = await getProfile();
      const { data: room } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', state.currentRoom)
        .single();

      const { data: player } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id)
        .single();

      if (!player || player.status !== 'playing') return;

      const deck = typeof room.deck === 'string' ? JSON.parse(room.deck) : room.deck;
      const hand = typeof player.hand === 'string' ? JSON.parse(player.hand) : player.hand;
      
      const newCard = deck[0];
      const newDeck = deck.slice(1);
      const newHand = [...hand, newCard];
      const newScore = calculateHandScore(newHand);
      const newStatus = newScore > 21 ? 'bust' : (newScore === 21 ? 'stand' : 'playing');

      await sb
        .from('blackjack_players')
        .update({
          hand: JSON.stringify(newHand),
          score: newScore,
          status: newStatus,
        })
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id);

      await sb
        .from('blackjack_rooms')
        .update({ deck: JSON.stringify(newDeck) })
        .eq('id', state.currentRoom);

      await renderGameState(state.currentRoom);
      if (newStatus === 'bust' || newStatus === 'stand') checkRoundEnd(state.currentRoom);
    } catch (error) {
      console.error('Error hitting:', error);
    } finally {
      setControlsBusy(false);
    }
  };

  const stand = async () => {
    if (!state.currentRoom) return;
    if (state.actionInFlight) return;

    try {
      setControlsBusy(true);
      const profile = await getProfile();
      await sb
        .from('blackjack_players')
        .update({ status: 'stand' })
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id);

      await renderGameState(state.currentRoom);
      checkRoundEnd(state.currentRoom);
    } catch (error) {
      console.error('Error standing:', error);
    } finally {
      setControlsBusy(false);
    }
  };

  const doubleDown = async () => {
    if (!state.currentRoom) return;
    if (state.actionInFlight) return;

    try {
      setControlsBusy(true);
      const profile = await getProfile();
      const { data: player } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id)
        .single();

      const hand = typeof player.hand === 'string' ? JSON.parse(player.hand) : player.hand;
      if (!player || hand.length !== 2) return;
      if (profile.balance < player.bet) {
        showMessage('bjGameMsg', 'Insufficient balance to double', 'error');
        return;
      }

      const { data: room } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', state.currentRoom)
        .single();

      const deck = typeof room.deck === 'string' ? JSON.parse(room.deck) : room.deck;
      const newCard = deck[0];
      const newDeck = deck.slice(1);
      const newHand = [...hand, newCard];
      const newScore = calculateHandScore(newHand);

      await sb
        .from('blackjack_players')
        .update({
          hand: JSON.stringify(newHand),
          score: newScore,
          bet: player.bet * 2,
          status: newScore > 21 ? 'bust' : 'stand',
        })
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id);

      await sb
        .from('blackjack_rooms')
        .update({ deck: JSON.stringify(newDeck) })
        .eq('id', state.currentRoom);

      await renderGameState(state.currentRoom);
      checkRoundEnd(state.currentRoom);
    } catch (error) {
      console.error('Error doubling down:', error);
    } finally {
      setControlsBusy(false);
    }
  };

  const checkRoundEnd = async (roomId) => {
    try {
      const profile = await getProfile();
      if (!profile) return;

      const { data: room } = await sb
        .from('blackjack_rooms')
        .select('host_id, status')
        .eq('id', roomId)
        .maybeSingle();

      // Only trigger dealer actions once (during play).
      if (!room || room.status !== 'playing') return;

      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', roomId);

      const allFinished = players.every(p => ['bust', 'stand', 'blackjack'].includes(p.status));
      if (allFinished) {
        if (room.host_id === profile.id) await dealerPlay(roomId);
      }
    } catch (error) {
      console.error('Error checking round end:', error);
    }
  };

  const dealerPlay = async (roomId) => {
    try {
      const { data: room } = await sb
        .from('blackjack_rooms')
        .select()
        .eq('id', roomId)
        .single();
      if (!room || room.status !== 'playing') return;

      let dealerHand = typeof room.dealer_hand === 'string' ? JSON.parse(room.dealer_hand) : room.dealer_hand;
      let deck = typeof room.deck === 'string' ? JSON.parse(room.deck) : room.deck;
      let dealerScore = calculateHandScore(dealerHand);

      while (dealerScore < 17) {
        dealerHand.push(deck[0]);
        deck = deck.slice(1);
        dealerScore = calculateHandScore(dealerHand);
      }

      await sb
        .from('blackjack_rooms')
        .update({
          dealer_hand: JSON.stringify(dealerHand),
          dealer_score: dealerScore,
          status: 'results',
        })
        .eq('id', roomId);

      await determineWinners(roomId, dealerScore);
      await updateBalances(roomId);

      document.getElementById('bjControls').style.display = 'none';
      await showGameResults(roomId);

      // Auto-start next betting phase after a short delay (host only).
      const profile = await getProfile();
      if (profile && room.host_id === profile.id) {
        if (state.nextRoundTimer) clearTimeout(state.nextRoundTimer);
        state.nextRoundTimer = setTimeout(() => {
          resetRoundStateForNextRound(roomId);
        }, 8000);
      }
    } catch (error) {
      console.error('Error in dealer play:', error);
    }
  };

  const determineWinners = async (roomId, dealerScore) => {
    try {
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', roomId);

      for (let p of players) {
        let result = 'lose';
        let winnings = 0;

        if (p.status === 'bust') {
          result = 'lose';
        } else if (dealerScore > 21) {
          result = 'win';
          winnings = p.bet * 2;
        } else if (p.score > dealerScore) {
          result = 'win';
          winnings = p.bet * 2;
        } else if (p.score === dealerScore) {
          result = 'push';
          winnings = p.bet;
        }

        await sb
          .from('blackjack_players')
          .update({ result: result, winnings: winnings })
          .eq('room_id', roomId)
          .eq('player_id', p.player_id);

        await sb
          .from('blackjack_history')
          .insert({
            player_id: p.player_id,
            room_id: roomId,
            bet: p.bet,
            winnings: winnings,
            result: result,
            profit: winnings - p.bet,
          });
      }
    } catch (error) {
      console.error('Error determining winners:', error);
    }
  };

  const updateBalances = async (roomId) => {
    try {
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', roomId);

      for (let p of players) {
        const { data: profile } = await sb
          .from('profiles')
          .select('balance')
          .eq('id', p.player_id)
          .single();

        const newBalance = profile.balance - p.bet + p.winnings;
        await sb
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', p.player_id);
      }
    } catch (error) {
      console.error('Error updating balances:', error);
    }
  };

  const showGameResults = async (roomId) => {
    try {
      const profile = await getProfile();
      const { data: room } = await sb.from('blackjack_rooms').select('host_id').eq('id', roomId).maybeSingle();
      const isHost = !!(profile && room && room.host_id === profile.id);

      const players = await fetchPlayersWithProfiles(roomId);

      let resultsHtml = '<div style="text-align: center;"><h3>Round Over</h3>';
      for (let p of players) {
        const profitText = p.winnings > p.bet ? `+${p.winnings - p.bet}` : `${p.winnings - p.bet}`;
        resultsHtml += `<div>${p.profiles?.username || 'Player'}: ${p.result.toUpperCase()} (${profitText})</div>`;
      }
      if (isHost) {
        resultsHtml += `
          <div style="margin-top:12px; color: var(--muted); font-size: 12px;">Next round starts automatically in a few seconds.</div>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:12px;">
            <button onclick="BJ.nextRoundNow()" class="secondary-wide" type="button">Next round now</button>
            <button onclick="BJ.closeRoom()" class="ghost" type="button">Close room</button>
          </div>
        `;
      } else {
        resultsHtml += `<div style="margin-top:12px; color: var(--muted); font-size: 12px;">Waiting for host to start next round...</div>`;
      }
      resultsHtml += '<div style="margin-top:12px;"><button onclick="BJ.returnToLobby()" class="primary-wide">Return to Lobby</button></div></div>';

      document.getElementById('bjGameMsg').innerHTML = resultsHtml;
    } catch (error) {
      console.error('Error showing results:', error);
    }
  };

  const nextRoundNow = async () => {
    if (!state.currentRoom) return;
    if (state.nextRoundTimer) {
      clearTimeout(state.nextRoundTimer);
      state.nextRoundTimer = 0;
    }
    await resetRoundStateForNextRound(state.currentRoom);
  };

  const closeRoom = async () => {
    if (!state.currentRoom) return;
    try {
      const profile = await getProfile();
      if (!profile) return;
      const { data: room } = await sb.from('blackjack_rooms').select('host_id').eq('id', state.currentRoom).maybeSingle();
      if (room && room.host_id === profile.id) {
        await sb.from('blackjack_rooms').delete().eq('id', state.currentRoom);
      }
    } catch {}
  };

  const returnToLobby = async () => {
    await leaveRoom();
    renderRoomsList();
    showLobby(true);
  };

  const forceExitRoom = (message) => {
    try {
      if (state.subscription) {
        state.subscription.unsubscribe();
        state.subscription = null;
      }
      if (state.playersSubscription) {
        state.playersSubscription.unsubscribe();
        state.playersSubscription = null;
      }
    } catch {}

    clearInterval(state.roomPollTimer);
    state.roomPollTimer = 0;

    if (state.nextRoundTimer) {
      clearTimeout(state.nextRoundTimer);
      state.nextRoundTimer = 0;
    }

    state.currentRoom = null;
    state.currentPlayer = null;
    state.currentRoomStatus = null;
    setWaitingRoomId('-');
    showLobby(true);
    showWaitingRoom(false);
    showGameTable(false);

    if (message) {
      try {
        showMessage('bjLobbyMsg', message, 'error');
      } catch {}
    }
  };

  const resetRoundStateForNextRound = async (roomId) => {
    const profile = await getProfile();
    if (!profile) return;

    const { data: room, error: roomErr } = await sb
      .from('blackjack_rooms')
      .select('host_id, round_number')
      .eq('id', roomId)
      .maybeSingle();
    if (roomErr || !room) return;

    // Only host can advance the room.
    if (room.host_id !== profile.id) return;

    const nextRound = Number(room.round_number || 0) + 1;
    const deck = createDeck();

    await sb
      .from('blackjack_players')
      .update({
        bet: 0,
        hand: JSON.stringify([]),
        score: 0,
        status: 'betting',
        result: null,
        winnings: 0,
      })
      .eq('room_id', roomId);

    await sb
      .from('blackjack_rooms')
      .update({
        status: 'betting',
        round_number: nextRound,
        deck: JSON.stringify(deck),
        dealer_hand: JSON.stringify([]),
        dealer_score: 0,
      })
      .eq('id', roomId);
  };

  const readBlackjackLock = async () => {
    try {
      const { data, error } = await window.sb.from('app_settings').select('value').eq('key', 'blackjack_lock').maybeSingle();
      if (error) throw error;
      const v = data?.value || {};
      return { enabled: Boolean(v.enabled), message: String(v.message || '') };
    } catch {
      return { enabled: false, message: '' };
    }
  };

  const isAdminUser = async () => {
    try {
      const { data: session } = await window.sb.auth.getSession();
      if (!session?.session) return false;
      const { data } = await window.sb.rpc('is_admin');
      return Boolean(data);
    } catch {
      return false;
    }
  };

  const showBlackjackBlocked = (message) => {
    const container = document.getElementById('bjContainer');
    if (!container) return;

    const existing = document.getElementById('bjBlocked');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'bjBlocked';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.padding = '24px';
    el.innerHTML = `
      <div style="width:min(720px,100%); border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); border-radius:18px; padding:18px; text-align:center;">
        <div style="font-weight:1000; font-size:18px; margin-bottom:6px;">Admin only</div>
        <div style="color:rgba(233,237,247,0.72); font-size:13px;">Blackjack is temporarily locked. An admin can unlock it in the admin panel.</div>
        <div style="margin-top:12px; white-space:pre-wrap;">${String(message || '').replace(/</g, '&lt;')}</div>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:14px;">
          <button id="bjBlockedRefresh" class="primary-wide" type="button">Refresh</button>
          <button id="bjBlockedBack" class="ghost" type="button">Back</button>
        </div>
      </div>
    `;

    const lobby = document.getElementById('bjLobby');
    const waiting = document.getElementById('bjWaitingRoom');
    const table = document.getElementById('bjTable');
    if (lobby) lobby.style.display = 'none';
    if (waiting) waiting.style.display = 'none';
    if (table) table.style.display = 'none';

    container.prepend(el);

    document.getElementById('bjBlockedRefresh')?.addEventListener('click', () => window.location.reload());
    document.getElementById('bjBlockedBack')?.addEventListener('click', () => window.history.back());
  };

  // ============ INITIALIZATION ============
  const init = async () => {
    console.log('🎰 ============ ИНИЦИАЛИЗАЦИЯ BLACKJACK ============');
    console.log('✅ window.sb доступен?', !!window.sb);
    console.log('✅ sb объект:', window.sb);
    
    if (!window.sb) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: sb не инициализирован! Проверьте supabase-config.js');
      showMessage('bjLobbyMsg', 'Error: Supabase is not initialized', 'error');
      return;
    }

    // Optional: lock Blackjack for non-admins via Admin panel (app_settings.key='blackjack_lock').
    const lock = await readBlackjackLock();
    if (lock.enabled) {
      const ok = await isAdminUser();
      if (!ok) {
        showBlackjackBlocked(lock.message || '');
        return;
      }
    }
    
    document.getElementById('bjCreateRoomBtn')?.addEventListener('click', createRoom);
    document.getElementById('bjJoinRoomBtn')?.addEventListener('click', joinRoomByInput);
    document.getElementById('bjLeaveTableBtn')?.addEventListener('click', leaveRoom);
    document.getElementById('bjWaitingLeaveBtn')?.addEventListener('click', leaveRoom);
    document.getElementById('bjReadyBtn')?.addEventListener('click', markReady);
    document.getElementById('bjCopyRoomIdBtn')?.addEventListener('click', copyRoomId);
    document.getElementById('bjConfirmBetBtn')?.addEventListener('click', confirmBet);
    document.getElementById('bjHitBtn')?.addEventListener('click', hit);
    document.getElementById('bjStandBtn')?.addEventListener('click', stand);
    document.getElementById('bjDoubleBtn')?.addEventListener('click', doubleDown);

    console.log('✅ Обработчики событий установлены');
    
    console.log('📋 Загружаем список комнат...');
    await renderRoomsList();
    setInterval(renderRoomsList, 3000);

    console.log('💰 Загружаем баланс...');
    await updateBalance();
    setInterval(updateBalance, 3000);
    
    console.log('🎮 ============ BLACKJACK ГОТОВ! ============');
  };

  const updateBalance = async () => {
    try {
      const profile = await getProfile();
      if (profile) {
        document.getElementById('bjBalanceValue').textContent = profile.balance || 0;
        console.log('✅ Баланс загружен:', profile.balance);
      } else {
        console.warn('⚠️ Профиль не получен при загрузке баланса');
      }
    } catch (error) {
      console.error('❌ Ошибка обновления баланса:', error);
    }
  };

  // Public API
  return {
    init,
    createRoom,
    joinRoom,
    leaveRoom,
    markReady,
    confirmBet,
    hit,
    stand,
    doubleDown,
    returnToLobby,
    nextRoundNow,
    closeRoom,
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', BJ.init);
} else {
  BJ.init();
}
