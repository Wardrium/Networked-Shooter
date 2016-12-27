// Server Settings
var update_time = 0.045;	// How often to send updates to clients, in seconds.
var tick_rate = 0.015;	// How often server updates game state, in seconds.

// Game Settings
var movement_speed = 1;	// How many pixels a player can move per game tick.
var max_bullets = 3;	// How many bullets can be shot at once per player.
var bullet_speed = 3;	// How many pixels a bullet can move per game tick.
var shooting_cooldown = 35;	// How many ticks a player has to wait before shooting again.

// Cocos2D v3.9 keys
var cc = {KEY: {
    none:0,
    back:6,
    menu:18,
    backspace:8,
    tab:9,
    enter:13,
    shift:16,
    ctrl:17,
    alt:18,
    pause:19,
    capslock:20,
    escape:27,
    space:32,
    pageup:33,
    pagedown:34,
    end:35,
    home:36,
    left:37,
    up:38,
    right:39,
    down:40,
    select:41,
    insert:45,
    Delete:46,
    0:48,
    1:49,
    2:50,
    3:51,
    4:52,
    5:53,
    6:54,
    7:55,
    8:56,
    9:57,
    a:65,
    b:66,
    c:67,
    d:68,
    e:69,
    f:70,
    g:71,
    h:72,
    i:73,
    j:74,
    k:75,
    l:76,
    m:77,
    n:78,
    o:79,
    p:80,
    q:81,
    r:82,
    s:83,
    t:84,
    u:85,
    v:86,
    w:87,
    x:88,
    y:89,
    z:90,
    num0:96,
    num1:97,
    num2:98,
    num3:99,
    num4:100,
    num5:101,
    num6:102,
    num7:103,
    num8:104,
    num9:105,
    '*':106,
    '+':107,
    '-':109,
    'numdel':110,
    '/':111,
    f1:112,
    f2:113,
    f3:114,
    f4:115,
    f5:116,
    f6:117,
    f7:118,
    f8:119,
    f9:120,
    f10:121,
    f11:122,
    f12:123,
    numlock:144,
    scrolllock:145,
    ';':186,
    semicolon:186,
    equal:187,
    '=':187,
    ',':188,
    comma:188,
    dash:189,
    '.':190,
    period:190,
    forwardslash:191,
    grave:192,
    '[':219,
    openbracket:219,
    backslash:220,
    ']':221,
    closebracket:221,
    quote:222,
    dpadLeft:1000,
    dpadRight:1001,
    dpadUp:1003,
    dpadDown:1004,
    dpadCenter:1005
}};

// Server-----------------------------------------------------
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

// Game state manager
var gm = {
	timestamp: 0,
	ID_count: 0,
	connections: [],	// Entries of form: {socket, ID}. If ID = -1, then not in game yet.
	players: {},		// map(ID, {name, color, position})
	bullets: {},		// map(ID, {position, velocity})
	inputs: {},			// map(ID, [unprocessed inputs])

	// Returns connection in connections array that contains the given socket.
	// If deleteAfter is true, will remove connection from connections array after finding it.
	GetConnection: function(socket, deleteAfter){
		for (var i = 0; i < this.connections.length; ++i){
			var connection = this.connections[i];
			if (connection.socket === socket){
				if (deleteAfter){
					this.connections.splice(i, 1);
				}
				return connection;
			}
		}
	},
	AddNewPlayer: function(name){
		position = this._GeneratePosition();
		color = this._GenerateColor();
		this.players[this.ID_count] = {'name': name, 'color': color, 'position': position};
		this.inputs[this.ID_count] = [];
		return this.ID_count++;	// Increment ID_count after returning current value
	},
	_GeneratePosition: function(){
		return {'x': Math.floor((Math.random() * 860)) + 50, 'y': Math.floor((Math.random() * 540)) + 50};
	},
	_GenerateColor: function(){
		return 'temp';
	},
	// Get full data of all players to send to anyone connecting to game for first time.
	GetPlayersFull: function(){
		return this.players;
	},
	// Get only data of all players that is neccessary for updating states of players.
	GetPlayersUpdate: function(){
		var players = {};
		for (var ID in this.players){
			var player = this.players[ID];
			players[ID] = {'position': player.position};
		}
		return players;
	},
	// Same as GetPlayersFull except only gets data of a specific player.
	GetPlayerFull: function(ID){
		var player = {};
		player[ID] = this.players[ID];
		return player;
	},
	SetPlayerInput: function(ID, inputs){
		this.inputs[ID] = this.inputs[ID].concat(inputs);
	},
	RemovePlayer: function(ID){
		delete this.players[ID];
		delete this.inputs[ID];
	},
	// Progress the game by one game tick.
	UpdateGame: function(){
		this.timestamp += 1;
		for (var ID in this.inputs){
			for (var i = 0; i < this.inputs[ID].length; ++i){
				var key = this.inputs[ID][i];
				switch(key){
					case cc.KEY.left:
						this.players[ID].position.x -= movement_speed;
						break;
					case cc.KEY.right:
						this.players[ID].position.x += movement_speed;
						break;
					case cc.KEY.up:
						this.players[ID].position.y += movement_speed;
						break;
					case cc.KEY.down:
						this.players[ID].position.y -= movement_speed;
						break;
				}
			}
			this.inputs[ID] = [];	// Empty input for this player.
		}
	},
};

// NodeJS server
server.listen(8081, "127.0.0.1");
console.log('Server running...')

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	gm.connections.push({'socket': socket, 'ID': -1});
	console.log("Connected: %s sockets connected", gm.connections.length)

	// Register
	socket.on('register', function(name){
		var ID = gm.AddNewPlayer(name);
		gm.GetConnection(socket, false).ID = ID;
		socket.emit('register', {'settings': {'timestamp': gm.timestamp, 'tick_rate': tick_rate, 'movement_speed': movement_speed,
								'max_bullets': max_bullets, 'bullet_speed': bullet_speed, 'shooting_cooldown': shooting_cooldown},
								'ID': ID, 'players': gm.GetPlayersFull()});
		for (var i = 0; i < gm.connections.length - 1; ++i){
			gm.connections[i].socket.emit('add player', gm.GetPlayerFull(ID));
		}
	});

	// Update player input
	socket.on('update', function(data){
		var connection = gm.GetConnection(socket, false);
		gm.SetPlayerInput(connection.ID, data.input);
	});

	// Send position updates to players
	setInterval(function (){
		for (var i = 0; i < gm.connections.length; ++i){
			gm.connections[i].socket.emit('update', gm.GetPlayersUpdate());
		}
	}, update_time * 1000);

	// Disconnect
	socket.on('disconnect', function(data){
		var ID = gm.GetConnection(socket, true).ID;
		gm.RemovePlayer(ID);
		// Alert all clients of player who left.
		for (var i = 0; i < gm.connections.length; ++i){
			gm.connections[i].socket.emit('remove player', ID);
		}
		console.log("Disconnected: %s sockets connected", gm.connections.length);
	})
});

// Update game state
setInterval(function(){
	gm.UpdateGame();
}, tick_rate * 1000);	// Multiply by a thousand to get milliseconds