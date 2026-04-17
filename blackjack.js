// Blackjack Game Engine
const BJ = (() => {
  const state = {
    currentRoom: null,
    currentPlayer: null,
    rooms: [],
    gameInProgress: false,
    subscription: null,
  };

  // Helper function to get current user profile
  const getProfile = async () => {
    try {
      // Получаем текущего пользователя из localStorage
      const storedUser = localStorage.getItem('gambling_current_user');
      console.log('📦 storedUser из localStorage:', storedUser);
      
      if (!storedUser) {
        console.error('❌ Пользователь не авторизован (нет в localStorage)');
        return null;
      }

      const currentUser = JSON.parse(storedUser);
      console.log('👤 currentUser:', currentUser);
      
      if (!currentUser.id) {
        console.error('❌ Нет ID пользователя');
        return null;
      }

      console.log('🔍 Ищем профиль для user_id:', currentUser.id);

      // Получаем профиль из Supabase
      const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      console.log('📊 Результат запроса profiles:', { profile, error });

      // Если профиль не найден, создаём его
      if (error || !profile) {
        console.warn('⚠️ Профиль не найден, создаём новый...');
        
        const newProfile = {
          id: currentUser.id,
          email: currentUser.email || 'unknown@email.com',
          username: currentUser.username || 'Player',
          balance: 5000,
        };

        console.log('➕ Создаём новый профиль:', newProfile);

        const { data: created, error: insertError } = await sb
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        console.log('➕ Результат вставки:', { created, insertError });

        if (insertError) {
          console.error('❌ Ошибка создания профиля:', insertError);
          // Пробуем ещё раз получить профиль (может быть конфликт)
          const { data: existing } = await sb
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
    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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
        showMessage('bjLobbyMsg', `Ошибка загрузки комнат: ${response.error.message}`, 'error');
        return;
      }

      const rooms = response.data || response || [];
      console.log('✅ Комнат найдено:', rooms.length);
      
      const list = document.getElementById('bjRoomsList');
      list.innerHTML = '';
      
      if (!rooms || rooms.length === 0) {
        list.innerHTML = '<div class="bj-room-item" style="cursor:auto; color: var(--muted);">Нет доступных комнат</div>';
        return;
      }
      
      for (let room of rooms) {
        const item = document.createElement('div');
        item.className = 'bj-room-item';
        item.innerHTML = `
          <div>
            <div style="font-weight: 600;">Комната ${room.id.substring(0, 8)}</div>
            <div style="font-size: 12px; color: var(--muted);">Мин ставка: ${room.min_bet} | Игроков: ${room.current_players}/${room.max_players}</div>
          </div>
          <button class="secondary" type="button" onclick="BJ.joinRoom('${room.id}')">Присоединиться</button>
        `;
        list.appendChild(item);
      }
    } catch (error) {
      console.error('❌ Критическая ошибка renderRoomsList:', error);
      showMessage('bjLobbyMsg', `Ошибка: ${error.message}`, 'error');
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

  const renderDealerHand = (cards, hideFirst = false) => {
    const container = document.getElementById('bjDealerHand');
    container.innerHTML = '';
    
    for (let i = 0; i < cards.length; i++) {
      if (hideFirst && i === 0) {
        container.appendChild(formatHiddenCard());
      } else {
        container.appendChild(formatCardDisplay(cards[i]));
      }
    }
  };

  const renderPlayersArea = (gameState) => {
    const container = document.getElementById('bjPlayersArea');
    container.innerHTML = '';
    
    if (!gameState.players || gameState.players.length === 0) {
      container.innerHTML = '<div style="text-align:center; color: var(--muted); padding: 20px;">No players yet</div>';
      return;
    }
    
    for (let player of gameState.players) {
      const seat = document.createElement('div');
      seat.className = `bj-player-seat ${player.status === 'active' ? 'active' : ''}`;
      
      const score = calculateHandScore(player.hand || []);
      const handDisplay = document.createElement('div');
      handDisplay.className = 'bj-player-hand';
      
      if (player.hand && player.hand.length > 0) {
        for (let card of player.hand) {
          handDisplay.appendChild(formatCardDisplay(card));
        }
      }
      
      seat.innerHTML = `
        <div class="bj-player-name">${player.username || 'Player'}</div>
      `;
      seat.appendChild(handDisplay);
      seat.innerHTML += `
        <div class="bj-player-info">
          <div>Score: <b>${score}</b></div>
          <div>Bet: <b>${player.bet}</b></div>
        </div>
      `;
      
      container.appendChild(seat);
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
        showMessage('bjLobbyMsg', 'Ошибка: не удалось получить профиль. Перезагрузитесь.', 'error');
        return;
      }

      const minBet = parseInt(document.getElementById('bjMinBetInput').value) || 10;
      if (minBet < 1) {
        showMessage('bjLobbyMsg', 'Минимальная ставка должна быть не менее 1', 'error');
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
        showMessage('bjLobbyMsg', `Ошибка создания комнаты: ${error.message}`, 'error');
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
        showMessage('bjLobbyMsg', `Ошибка добавления игрока: ${playerError.message}`, 'error');
        return;
      }

      console.log('✅ Игрок добавлен:', playerData);

      state.currentRoom = roomId;
      state.currentPlayer = profile.id;

      showMessage('bjLobbyMsg', '✅ Комната создана! Ожидаем других игроков...', 'success');
      showLobby(false);
      showWaitingRoom(true);
      renderWaitingRoom(roomId);

      subscribeToRoom(roomId);
    } catch (error) {
      console.error('❌ Критическая ошибка создания комнаты:', error);
      showMessage('bjLobbyMsg', `Критическая ошибка: ${error.message}`, 'error');
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
          hand: [],
          score: 0,
          status: 'waiting',
          result: null,
          winnings: 0,
          seat_position: nextSeat,
        });

      if (insertError) throw insertError;

      const { error: updateError } = await sb
        .from('blackjack_rooms')
        .update({ current_players: room.current_players + 1 })
        .eq('id', roomId);

      if (updateError) throw updateError;

      state.currentRoom = roomId;
      state.currentPlayer = profile.id;

      showMessage('bjLobbyMsg', 'Joined room!', 'success');
      showLobby(false);
      showWaitingRoom(true);
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
        await sb
          .from('blackjack_players')
          .delete()
          .eq('room_id', state.currentRoom)
          .eq('player_id', profile.id);

        const { data: room } = await sb
          .from('blackjack_rooms')
          .select()
          .eq('id', state.currentRoom)
          .single();

        if (room && room.current_players > 1) {
          await sb
            .from('blackjack_rooms')
            .update({ current_players: room.current_players - 1 })
            .eq('id', state.currentRoom);
        } else if (room) {
          await sb
            .from('blackjack_rooms')
            .delete()
            .eq('id', state.currentRoom);
        }
      }

      state.currentRoom = null;
      state.currentPlayer = null;
      showLobby(true);
      showWaitingRoom(false);
      showGameTable(false);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const subscribeToRoom = (roomId) => {
    if (state.subscription) {
      state.subscription.unsubscribe();
    }

    state.subscription = sb
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) {
            renderWaitingRoom(roomId);
            if (payload.new.status === 'playing') {
              showWaitingRoom(false);
              showGameTable(true);
              startGameView(payload.new);
            }
          }
        }
      )
      .subscribe();
  };

  const renderWaitingRoom = async (roomId) => {
    try {
      const { data: players, error } = await sb
        .from('blackjack_players')
        .select('*, profiles!player_id(username)')
        .eq('room_id', roomId);

      if (error) throw error;

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

      await sb
        .from('blackjack_rooms')
        .update({ status: 'betting', round_number: 1 })
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
      const { data: players, error } = await sb
        .from('blackjack_players')
        .select('*, profiles!player_id(username)')
        .eq('room_id', room.id);

      if (error) throw error;

      document.getElementById('bjCurrentRoomId').textContent = room.id.substring(0, 8);
      document.getElementById('bjPlayerCount').textContent = `${players?.length || 0}/${room.max_players}`;

      // Show betting phase for all players
      document.getElementById('bjBettingPhase').style.display = 'block';
      document.getElementById('bjControls').style.display = 'none';
      document.getElementById('bjGameMsg').innerHTML = '';

      renderPlayersArea({ players: players || [] });
      renderDealerHand([]);
    } catch (error) {
      console.error('Error starting game view:', error);
    }
  };

  const confirmBet = async () => {
    if (!state.currentRoom) return;

    try {
      const profile = await getProfile();
      if (!profile) throw new Error('No profile');

      const bet = parseInt(document.getElementById('bjBetInput').value);
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

      // Check if all players have bet
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', state.currentRoom);

      const allBet = players.every(p => p.bet > 0);
      if (allBet) {
        startRound(state.currentRoom, room);
      }

      showMessage('bjBettingMsg', 'Bet confirmed!', 'success');
    } catch (error) {
      console.error('Error confirming bet:', error);
      showMessage('bjBettingMsg', 'Error placing bet', 'error');
    }
  };

  const startRound = async (roomId, room) => {
    try {
      const deck = createDeck();
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', roomId);

      // Deal cards
      for (let p of players) {
        await sb
          .from('blackjack_players')
          .update({
            hand: JSON.stringify([deck[0], deck[1]]),
            score: calculateHandScore([deck[0], deck[1]]),
            status: 'playing',
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

      const { data: players } = await sb
        .from('blackjack_players')
        .select('*, profiles!player_id(username)')
        .eq('room_id', roomId);

      const dealerHand = typeof room.dealer_hand === 'string' ? JSON.parse(room.dealer_hand) : room.dealer_hand;
      renderDealerHand(dealerHand, true);
      document.getElementById('bjDealerScore').textContent = calculateHandScore([dealerHand[0]]);

      const playersWithParsedHands = players.map(p => ({
        ...p,
        hand: typeof p.hand === 'string' ? JSON.parse(p.hand) : p.hand
      }));
      renderPlayersArea({ players: playersWithParsedHands });

      const profile = await getProfile();
      const currentPlayer = playersWithParsedHands.find(p => p.player_id === profile.id);
      if (currentPlayer) {
        document.getElementById('bjCurrentPlayerName').textContent = currentPlayer.profiles?.username || 'You';
        document.getElementById('bjCurrentPlayerScore').textContent = currentPlayer.score;
      }
    } catch (error) {
      console.error('Error rendering game state:', error);
    }
  };

  const hit = async () => {
    if (!state.currentRoom) return;

    try {
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

      await sb
        .from('blackjack_players')
        .update({
          hand: JSON.stringify(newHand),
          score: newScore,
          status: newScore > 21 ? 'bust' : 'playing',
        })
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id);

      await sb
        .from('blackjack_rooms')
        .update({ deck: JSON.stringify(newDeck) })
        .eq('id', state.currentRoom);

      renderGameState(state.currentRoom);
    } catch (error) {
      console.error('Error hitting:', error);
    }
  };

  const stand = async () => {
    if (!state.currentRoom) return;

    try {
      const profile = await getProfile();
      await sb
        .from('blackjack_players')
        .update({ status: 'stand' })
        .eq('room_id', state.currentRoom)
        .eq('player_id', profile.id);

      renderGameState(state.currentRoom);
      checkRoundEnd(state.currentRoom);
    } catch (error) {
      console.error('Error standing:', error);
    }
  };

  const doubleDown = async () => {
    if (!state.currentRoom) return;

    try {
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

      renderGameState(state.currentRoom);
      checkRoundEnd(state.currentRoom);
    } catch (error) {
      console.error('Error doubling down:', error);
    }
  };

  const checkRoundEnd = async (roomId) => {
    try {
      const { data: players } = await sb
        .from('blackjack_players')
        .select()
        .eq('room_id', roomId);

      const allFinished = players.every(p => ['bust', 'stand', 'blackjack'].includes(p.status));
      if (allFinished) {
        await dealerPlay(roomId);
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
          status: 'finished',
        })
        .eq('id', roomId);

      await determineWinners(roomId, dealerScore);
      await updateBalances(roomId);

      document.getElementById('bjControls').style.display = 'none';
      showGameResults(roomId);
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
      const { data: players } = await sb
        .from('blackjack_players')
        .select('*, profiles!player_id(username)')
        .eq('room_id', roomId);

      let resultsHtml = '<div style="text-align: center;"><h3>Round Over</h3>';
      for (let p of players) {
        const profitText = p.winnings > p.bet ? `+${p.winnings - p.bet}` : `${p.winnings - p.bet}`;
        resultsHtml += `<div>${p.profiles?.username || 'Player'}: ${p.result.toUpperCase()} (${profitText})</div>`;
      }
      resultsHtml += '<button onclick="BJ.returnToLobby()" class="primary-wide">Return to Lobby</button></div>';

      document.getElementById('bjGameMsg').innerHTML = resultsHtml;
    } catch (error) {
      console.error('Error showing results:', error);
    }
  };

  const returnToLobby = async () => {
    await leaveRoom();
    renderRoomsList();
    showLobby(true);
  };

  // ============ INITIALIZATION ============
  const init = async () => {
    console.log('🎰 ============ ИНИЦИАЛИЗАЦИЯ BLACKJACK ============');
    console.log('✅ window.sb доступен?', !!window.sb);
    console.log('✅ sb объект:', window.sb);
    
    if (!window.sb) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: sb не инициализирован! Проверьте supabase-config.js');
      showMessage('bjLobbyMsg', 'Ошибка: Supabase не инициализирован', 'error');
      return;
    }
    
    document.getElementById('bjCreateRoomBtn')?.addEventListener('click', createRoom);
    document.getElementById('bjJoinRoomBtn')?.addEventListener('click', joinRoomByInput);
    document.getElementById('bjLeaveTableBtn')?.addEventListener('click', leaveRoom);
    document.getElementById('bjWaitingLeaveBtn')?.addEventListener('click', leaveRoom);
    document.getElementById('bjReadyBtn')?.addEventListener('click', markReady);
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
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', BJ.init);
} else {
  BJ.init();
}
