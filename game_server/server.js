// Server Settings
var update_time = 0.045;	// How often to send updates to clients, in seconds.
var tick_rate = 0.015;	// How often server updates game state, in seconds.

// Game Settings
var settings = {
	movement_speed: 1,	// How many pixels a player can move per game tick.
	max_bullets: 3,		// How many bullets can be shot at once per player.
	bullet_speed: 3,	// How many pixels a bullet can move per game tick.
	shooting_cooldown: 35,	// How many ticks a player has to wait before shooting again.
	player_health: 10,
	bullet_damage: 1,
}


// Cocos2D-js variables/functions
var cc = {};
cc.KEY = {
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
};
cc.rectIntersectsRect = function (ra, rb) {
    var maxax = ra.x + ra.width,
        maxay = ra.y + ra.height,
        maxbx = rb.x + rb.width,
        maxby = rb.y + rb.height;
    return !(maxax < rb.x || maxbx < ra.x || maxay < rb.y || maxby < ra.y);
};
cc.Rect = function (x, y, width, height) {
    this.x = x||0;
    this.y = y||0;
    this.width = width||0;
    this.height = height||0;
};

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
	players: {},		// map(ID, {name, color, position, health})
	bullets: {},		// map(ID, [{position, velocity}])
	unprocessed_inputs: {},			// map(ID, [unprocessed inputs])
	unprocessed_bullets: {},		// map(ID, [{position, velocity}])
	unsent_bullets: [],				// [ID, timestamp, position, velocity]. Bullets that were processed but not sent to clients yet.
	removed_bullets: [],			// [ID, index]. Bullets that were destroyed. Note: Must remove in same order on client to keep index consistent.

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
		this.players[this.ID_count] = {'name': name, 'color': color, 'position': position, 'health': settings.player_health};
		this.bullets[this.ID_count] = [];
		this.unprocessed_inputs[this.ID_count] = [];
		this.unprocessed_bullets[this.ID_count] = [];
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
			players[ID] = {'position': player.position, 'health': player.health};
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
		this.unprocessed_inputs[ID] = this.unprocessed_inputs[ID].concat(inputs);
	},
	DamagePlayer: function(ID, amt){
		this.players[ID].health -= amt;
	},
	RemovePlayer: function(ID){
		delete this.players[ID];
		delete this.bullets[ID];
		delete this.unprocessed_inputs[ID];
		delete this.unprocessed_bullets[ID];
	},
	// Add a bullet into the game. Will calculate bullet's position at current timestamp from the timestamp it was fired at.
	AddBullet: function(ID, position, velocity){
		gm.bullets[ID].push({'position': position, 'velocity': velocity});
		this.unsent_bullets.push({'ID': ID, 'position': position, 'velocity': velocity});
	},
	RemoveBullet: function(ID, index){
		gm.bullets[ID].splice(index, 1);
		gm.removed_bullets.push({'ID': ID, 'index': index});
	},
	// Progress the game by one game tick.
	UpdateGame: function(){
		// Process inputs
		for (var ID in this.unprocessed_inputs){
			for (var i = 0; i < this.unprocessed_inputs[ID].length; ++i){
				var key = this.unprocessed_inputs[ID][i];
				var target_pos = this.players[ID].position;
				switch(key){
					case cc.KEY.a:
						target_pos.x -= settings.movement_speed;
						break;
					case cc.KEY.d:
						target_pos.x += settings.movement_speed;
						break;
					case cc.KEY.w:
						target_pos.y += settings.movement_speed;
						break;
					case cc.KEY.s:
						target_pos.y -= settings.movement_speed;
						break;
				}

				if (target_pos.x < 50)
            		target_pos.x = 50;
        		else if (target_pos.x > 910)
            		target_pos.x = 910;
	            if (target_pos.y < 50)
	                target_pos.y = 50;
	            else if (target_pos.y > 590)
	                target_pos.y = 590;
	            this.players[ID].position = target_pos;
			}
			this.unprocessed_inputs[ID] = [];	// Empty input for this player.
		}

		// Process bullets
		for (var ID in this.unprocessed_bullets){
			for (var i = 0; i < this.unprocessed_bullets[ID].length; ++i){
				var bullet = this.unprocessed_bullets[ID][i];
				this.AddBullet(ID, bullet.position, bullet.velocity);
			}
			this.unprocessed_bullets[ID] = [];
		}

		// Move bullets
		for (var ID in this.bullets){
			for (var i = 0; i < this.bullets[ID].length; ++i){
				var removed = false;
				var bullet = this.bullets[ID][i];
				bullet.position.x = bullet.position.x + bullet.velocity.x;
				bullet.position.y = bullet.position.y + bullet.velocity.y;
				// Detect if bullet moved offscreen.
				if (bullet.position.x < 5 || bullet.position.y < 5 
					|| bullet.position.x > 955 || bullet.position.y > 635){
					removed = true;
                }
                if (!removed){
	                // Detect if bullet hits a player in O(n^2). TODO: Implement collision detection with grids.
	                for (var playerID in this.players){
	                	if (ID != playerID){
	                		if (this._CheckCollision(bullet.position, this.players[playerID].position)){
	                			this.DamagePlayer(playerID, settings.bullet_damage);
	                			removed = true;
	                			break;
	                		}
	                	}
	                }
	            }	
                if (removed){
                	this.RemoveBullet(ID, i);
                	i -= 1; // Move i back one to make up for removing bullet from array.
                }
			}
		}

		this.timestamp += 1;
	},
	// Returns true if bullet collides with player, false otherwise.
	_CheckCollision(bullet_pos, player_pos){
		var x1 = bullet_pos.x;
		var y1 = bullet_pos.y;
		var r1 = 5;
		var x2 = player_pos.x;
		var y2 = player_pos.y;
		var r2 = 50;
		return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) <= Math.pow(r1 + r2, 2)
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
		socket.emit('register', {'timestamp': gm.timestamp, 'settings': settings, 'ID': ID, 'players': gm.GetPlayersFull()});
		for (var i = 0; i < gm.connections.length - 1; ++i){
			gm.connections[i].socket.emit('add player', gm.GetPlayerFull(ID));
		}
	});

	// Update player input and unprocessed bullets
	socket.on('update', function(data){
		var connection = gm.GetConnection(socket, false);
		if (connection.ID == -1){
			socket.emit('refresh');
			socket.disconnect();
		}
		else {
			gm.SetPlayerInput(connection.ID, data.input);
			gm.unprocessed_bullets[connection.ID] = gm.unprocessed_bullets[connection.ID].concat(data.unprocessed_bullets);
		}
	});

	// Send position updates to players and new bullets shot
	setInterval(function (){
		for (var i = 0; i < gm.connections.length; ++i){
			if (gm.connections[i].ID != -1){
				gm.connections[i].socket.emit('update', {'timestamp': gm.timestamp, 'playerInfo': gm.GetPlayersUpdate(), 
					'bulletInfo': gm.unsent_bullets, 'removedBulletInfo': gm.removed_bullets});
			}
		}
		gm.unsent_bullets = [];
		gm.removed_bullets = [];
	}, update_time * 1000);

	// Disconnect
	socket.on('disconnect', function(data){
		var ID = gm.GetConnection(socket, true).ID;
		if (ID != -1){
			gm.RemovePlayer(ID);
			// Alert all clients of player who left.
			for (var i = 0; i < gm.connections.length; ++i){
				gm.connections[i].socket.emit('remove player', ID);
			}
		}
		console.log("Disconnected: %s sockets connected", gm.connections.length);
	})
});

// Update game state
setInterval(function(){
	gm.UpdateGame();
}, tick_rate * 1000);	// Multiply by a thousand to get milliseconds